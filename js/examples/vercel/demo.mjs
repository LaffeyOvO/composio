import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { VercelAIToolSet } from "../../lib/frameworks/vercel.js";
import dotenv from "dotenv";

dotenv.config();

const toolset = new VercelAIToolSet({
  apiKey: "gz9byycic0mhhk2plynqyb",
});

async function setupUserConnectionIfNotExists(entityId) {
  const entity = await toolset.client.getEntity(entityId);
  const connection = await entity.getConnection("github");

  if (!connection) {
    // If this entity/user hasn't already connected the account
    const connection = await entity.initiateConnection("github");
    console.log("Log in via: ", connection.redirectUrl);
    return connection.waitUntilActive(60);
  }

  return connection;
}

async function executeAgent(entityName) {
  const entity = await toolset.client.getEntity(entityName);
  await setupUserConnectionIfNotExists(entity.id);

  const given_tools = await toolset.get_actions(
    { actions: ["github_issues_create"] }
    // entity.id
  );

  const tool_params = convertObject(
    given_tools[0].function.parameters.properties
  );

  function convertObject(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = value.description;
    }
    return result;
  }

  // console.log(tool_params);

  const result = await generateText({
    model: openai("gpt-4-turbo"),
    tools: {
      github_issues_create: tool({
        description: given_tools[0]["function"]["description"],
        parameters: z.object(tool_params),
        execute: async (parameters) => {
          console.log(parameters);
          return {
            ...parameters,
            temperature: 72 + Math.floor(Math.random() * 21) - 10,
          };
        },
      }),
    },
    // tools: {
    //   weather: tool({
    //     description: "Get the weather in a location",
    //     parameters: z.object({
    //       location: z.string().describe("The location to get the weather for"),
    //     }),
    //     execute: async (params) => {
    //       console.log(params);
    //       return {
    //         ...params,
    //         temperature: 72 + Math.floor(Math.random() * 21) - 10,
    //       };
    //     },
    //   }),
    // },
    toolChoice: "required",
    prompt: "create issue in anonthedev/break repo",
    // prompt: "What is the weather in San Francisco and what attractions should I visit?",
  });

  console.log(result);
}

executeAgent("github");
