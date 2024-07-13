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

  console.log(connection)

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
    { actions: ["github_issues_create"] },
    entity.id
  );

  const tool_params = convertObject(
    given_tools[0].function.parameters.properties
  );

  function convertObject(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = z.string().describe(value.description);
    }
    return result;
  }

  const result = await generateText({
    model: openai("gpt-4-turbo"),
    tools: {
      github_issues_create: tool({
        description: given_tools[0]["function"]["description"],
        parameters: z.object(tool_params),
        execute: async (parameters) => {
          // console.log(parameters);
          return {
            ...parameters
          };
        },
      }),
    },
    toolChoice: "required",
    prompt: "Make an issue with sample title in the repo - anonthedev/break, only use the tools",
  });

  // console.log(result.toolResults);
  const handle_tool_call_results = []

  result.toolResults.forEach((toolResult)=>{
    handle_tool_call_results.push({name: toolResult.toolName, arguments: toolResult.args})
  })
  
  console.log(handle_tool_call_results)
  
  const final = await toolset.handle_tool_call(handle_tool_call_results, entity.id)
  console.log(final)
}

executeAgent('default');
