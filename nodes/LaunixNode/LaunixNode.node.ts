import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import type { IDataObject, ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

export class LaunixNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Launix API',
		name: 'launixNode',
		icon: { light: 'file:logo.svg', 'dark': 'file:logo.svg' },
		group: ['input'], // trigger, input, transform, output
		version: 1,
		description: 'Access your Launix software, retrieve data, insert items',
		defaults: {
			name: 'Launix',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'launixCredentialsApi',
				required: true,
			}
		],
		properties: [
			// Node properties which the user gets displayed and
			// can change on the node.
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'view',
				required: true,
				options: [
					{ name: 'Create', value: 'create', description: 'Insert an item', action: 'Insert an item' },
					{ name: 'Custom Action', value: 'custom', description: 'Custom action call like Invoice-Send', action: 'Custom action' },
					{ name: 'Delete', value: 'delete', description: 'Delete an item permanently', action: 'Delete an item permanently' },
					{ name: 'Edit', value: 'edit', description: 'Update an item', action: 'Update an item' },
					{ name: 'List', value: 'list', description: 'Retrieve a list of items', action: 'Retrieve a list of items' },
					{ name: 'View', value: 'view', description: 'Retrieve an item', action: 'Retrieve an item' },
				],
				description: 'What do you want to perform on the data',
			},
			{
				displayName: 'Dataset ID',
				name: 'id',
				type: 'string',
				default: "1",
				required: true,
				displayOptions: {
					show: {
						operation: [
							'view',
							'edit',
							'delete',
						],
					}
				},
				description: 'Which dataset do you want to view/edit/delete',
			},
			{
				displayName: 'Data',
				name: 'data',
				type: 'json',
				default: "{}",
				required: true,
				displayOptions: {
					show: {
						operation: [
							'create',
							'edit',
						],
					}
				},
				description: 'Add data from the fields',
			},
			{
				displayName: 'Filter and Sort Parameters',
				name: 'filterparams',
				type: 'json',
				default: "{\n  \"filter_user_ID\": \"1\",\n  \"sort_user\": \"username ASC\"\n}",
				required: true,
				displayOptions: {
					show: {
						operation: [
							'list',
						],
					}
				},
				description: 'Specify the GET parameters for that dataview',
			},
			/* TODO: custom call selector according to table, e.g. send campaign mails or such */
		],
	};

	methods = {
		listSearch: {
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
						tables.push({name: apiinfo.tables[classname].descSingle + ' (' + apiinfo.tables[classname].tblname + ')', value: classname});
					}
				}

				return {
					results: tables
				};
			}
		}
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `myString` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('launixCredentialsApi');
		const items = this.getInputData();

		let item: INodeExecutionData;
		const table = (this.getNodeParameter('table', 0, {}) as IDataObject).value;
		const operation = (this.getNodeParameter('operation', 0, 'view') as string);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				item = items[itemIndex];
				let url = credentials.baseurl + '/TablesAPI/' + table + '/' + operation;
				if (operation === 'view' || operation === 'edit' || operation === 'delete') {
					url += '?id=' + encodeURIComponent(this.getNodeParameter('id', itemIndex, '') as string);
				}
				if (operation === 'list') {
					let params = JSON.parse(this.getNodeParameter('filterparams', itemIndex, {}) as string);
					url += '?' + Object.keys(params).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k] as string));
				}
				const result = await this.helpers.request(url, {
					method: operation === 'edit' || operation === 'create' ? 'POST' : 'GET',
					headers: {
						'Authorization': 'Bearer ' + credentials.token,
					},
					body: operation === 'edit' || operation === 'create' ? this.getNodeParameter('data', itemIndex, '{}') as string : undefined,
					json: true
				});
				if (result['error']) throw result['error'];

				if (operation === 'delete') {
					item.json = { deleted: result };
				} else if (operation === 'create') {
					item.json = { id: result };
				} else if (operation === 'edit') {
					item.json = { result: result };
				} else if (operation === 'list') {
					item.json = result;
				} else {
					item.json = { data: result };
				}
			} catch (error) {
				// This node should never fail but we want to showcase how
				// to handle errors.
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [items];
	}
}
