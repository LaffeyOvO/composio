import { CoreTool, GenerateTextResult, tool } from "ai";
import { ComposioToolSet as BaseComposioToolSet } from "../sdk/base.toolset";
import { z, ZodString } from "zod";

type Optional<T> = T | null;
type Sequence<T> = Array<T>;

export class VercelAIToolSet extends BaseComposioToolSet {
  constructor(config: {
    apiKey?: Optional<string>;
    baseUrl?: Optional<string>;
    entityId?: string;
  }) {
    super(
      config.apiKey || null,
      config.baseUrl || null,
      "cloudflare",
      config.entityId || "default"
    );
  }

  async get_actions(filters: {
    actions: Sequence<string>;
  }): Promise<{ [key: string]: any }> {
    const result: { [key: string]: any } = {};
  
    const actionsList = await this.client.actions.list({});
    actionsList.items
      ?.filter((a) => {
        return filters.actions.includes(a!.name!);
      })
      .forEach((action) => {
        const newProperties: { [key: string]: ZodString } = {};
        for (const [key, value] of Object.entries(
          action.parameters?.properties as {
            [key: string]: {
              type: string;
              description?: string;
              title: string;
            };
          }
        )) {
          newProperties[key] = z.string().describe(value.description || "");
        }
  
        const finalTool = {
          [action.name!]: tool({
            description: action.description,
            parameters: z.object(newProperties),
            execute: async (parameters) => {
              return {
                ...parameters,
              };
            },
          }),
        };
        Object.assign(result, finalTool);
      });
  
    return result;
  }
  

  async get_tools(filters: {
    apps: Sequence<string>;
    tags: Optional<Array<string>>;
    useCase: Optional<string>;
  }): Promise<Sequence<any>> {
    return (
      (
        await this.client.actions.list({
          apps: filters.apps.join(","),
          tags: filters.tags?.join(","),
          filterImportantActions: !filters.tags && !filters.useCase,
          useCase: filters.useCase || undefined,
        })
      ).items?.map((action) => {
        const formattedSchema: any["function"] = {
          name: action.name!,
          description: action.description!,
          parameters: action.parameters as unknown as {
            type: "object";
            properties: {
              [key: string]: {
                type: string;
                description?: string;
              };
            };
            required: string[];
          },
        };
        const tool: any = {
          type: "function",
          function: formattedSchema,
        };
        return tool;
      }) || []
    );
  }

  async execute_tool_call(
    tool: {
      name: string;
      arguments: unknown;
    },
    entityId: Optional<string> = null
  ): Promise<string> {
    return JSON.stringify(
      await this.execute_action(
        tool.name,
        typeof tool.arguments === "string"
          ? JSON.parse(tool.arguments)
          : tool.arguments,
        entityId || this.entityId
      )
    );
  }

  async handle_tool_call(
    result: GenerateTextResult<Record<string, CoreTool>>["toolCalls"],
    entityId: Optional<string> = null
  ): Promise<Sequence<string>> {
    const handle_tool_call_results: { name: string; arguments: Object }[] = [];

    result.forEach((toolCall) => {
      handle_tool_call_results.push({
        name: toolCall.toolName,
        arguments: toolCall.args,
      });
    });

    const outputs = [];

    for (const tool_call of handle_tool_call_results) {
      if (tool_call.name) {
        outputs.push(await this.execute_tool_call(tool_call, entityId));
      }
    }
    return outputs;
  }
}
