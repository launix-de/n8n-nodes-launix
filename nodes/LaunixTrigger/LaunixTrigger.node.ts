import {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';

import { NodeApiError, NodeOperationError, NodeConnectionType, IDataObject, JsonObject, ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

export class LaunixTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Launix Trigger',
		name: 'launixTrigger',
		icon: 'file:logo.svg',
		group: ['trigger'],
		inputs: [],   // ✅ no inputs for triggers
		outputs: [NodeConnectionType.Main],  // ✅ one main output
		version: 1,
		subtitle: '={{$parameter["table"] + ":" + $parameter["action"]}}',
		description: 'Starts the workflow when data is created/edited in Launix',
		defaults: {
			name: 'Launix Trigger',
		},
		credentials: [
			{
				name: 'launixCredentialsApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'GET',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Table',
				name: 'table',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'Table',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchTables',
							searchable: true,
						},
					}
				],
				placeholder: 'Select a Table...',
				description: 'The table you want to work on',
			},
			{
				displayName: 'Action',
				name: 'action',
				type: 'options',
				options: [
					{ name: 'Created', value: 'created' },
					//{ name: 'Edited', value: 'edited' },
					// TODO: more events to listen to (need endpoint to list them)
				],
				default: 'created',
				required: true,
			},
		],
	};

	methods = {
		listSearch: {
			// load tables
			searchTables: async function (this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const credentials = await this.getCredentials('launixCredentialsApi');

				//const nodeOptions = this.getNodeParameter('options', 0) as IDataObject;

				const apiinfo = await this.helpers.request(credentials.baseurl + '/FOP/Index/api', {
					method: 'GET',
					headers: {
						'Authorization': 'Bearer ' + credentials.token,
					},
					json: true
				});

				var tables = [];
				for (var classname in apiinfo.tables) {
					if (!filter || apiinfo.tables[classname].descSingle.toUpperCase().includes(filter.toUpperCase())) {
						tables.push({name: apiinfo.tables[classname].descSingle + ' (' + apiinfo.tables[classname].tblname + ')', value: apiinfo.tables[classname].tblname});
					}
				}

				return {
					results: tables
				};
			}
		},
	};

	// On deploy → Register trigger in Launix
	webhookMethods = {
		default: {
			// When workflow is activated
			async create(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('launixCredentialsApi');
				if (!credentials) {
					throw new NodeOperationError(this.getNode(), 'No credentials returned!');
				}

				const baseUrl = credentials.baseurl as string;
				const token = credentials.token as string;

				const table = (this.getNodeParameter('table', {}) as IDataObject).value as string;
				const action = this.getNodeParameter('action') as string;

				const webhookUrl = this.getNodeWebhookUrl('default');
				const workflowId = this.getWorkflow().id;
				const n8nBaseUrl = this.getInstanceBaseUrl();


				// 1. Clean up old triggers for same webhook
				const listResponse = await this.helpers.httpRequest({
					method: 'GET',
					url: `${baseUrl}/TablesAPI/Fop_event/list`,
					headers: {
						Authorization: `Bearer ${token}`,
					},
					qs: {
						[`filter_fop_event_${table}:reaction:webhook:url`]: webhookUrl,
					},
					json: true,
				});

				if (Array.isArray(listResponse?.items)) {
					for (const item of listResponse.items) {
						if (item.ID) {
							await this.helpers.httpRequest({
								method: 'GET',
								url: `${baseUrl}/TablesAPI/Fop_event/delete`,
								headers: {
									Authorization: `Bearer ${token}`,
								},
								qs: { id: item.ID },
							});
						}
					}
				}

				// 2. Create new trigger
				const body = {
					tbl: table,
					action: `${table}:${action}`,
					reaction: `${table}:webhook`,
					[`${table}:reaction:webhook:url`]: webhookUrl,
					comment: `n8n Trigger ${n8nBaseUrl}workflow/${workflowId}`,
				};

				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: `${baseUrl}/TablesAPI/Fop_event/create`,
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body,
					json: true,
				});

				if (!response) {
					throw new NodeApiError(this.getNode(), response as JsonObject, { message: 'No trigger ID returned from Launix API' });
				}

				// Store trigger id so we can delete it later
				this.getWorkflowStaticData('node').triggerId = response;

				return true;
			},

			// When workflow is deactivated
			async delete(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('launixCredentialsApi');
				if (!credentials) {
					throw new NodeOperationError(this.getNode(), 'No credentials returned!');
				}

				const baseUrl = credentials.baseurl as string;
				const token = credentials.token as string;

				const staticData = this.getWorkflowStaticData('node');
				const triggerId = staticData.triggerId as string;

				if (!triggerId) {
					return true; // Nothing to delete
				}

				await this.helpers.httpRequest({
					method: 'GET',
					url: `${baseUrl}/TablesAPI/Fop_event/delete`,
					headers: {
						Authorization: `Bearer ${token}`,
					},
					qs: { id: triggerId },
				});

				delete staticData.triggerId;

				return true;
			},

			async checkExists(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('launixCredentialsApi');
				if (!credentials) {
					throw new NodeOperationError(this.getNode(), 'No credentials returned!');
				}

				const baseUrl = credentials.baseurl as string;
				const token = credentials.token as string;

				const staticData = this.getWorkflowStaticData('node');
				const triggerId = staticData.triggerId as string | undefined;

				if (!triggerId) {
					return false;
				}

				try {
					const response = await this.helpers.httpRequest({
						method: 'GET',
						url: `${baseUrl}/TablesAPI/Fop_event/list`,
						headers: {
							Authorization: `Bearer ${token}`,
						},
						qs: {
							filter_ID: triggerId,
						},
						json: true,
					});

					if (Array.isArray(response?.items) && response.items.length > 0) {
						return true;
					}

					return false;
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as JsonObject, {
						message: 'Error checking trigger existence in Launix API',
					});
				}
			}
		},
	};

	// Called when webhook is hit
	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const query = this.getQueryData() as IDataObject;
		//const body = this.getBodyData();
		return {
			workflowData: [ [ { json: { id: query['id'] } } ] ],
		};
	}
}
