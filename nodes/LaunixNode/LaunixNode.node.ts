import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import type { IDataObject, ILoadOptionsFunctions, INodeListSearchResult, ResourceMapperFields, ResourceMapperField } from 'n8n-workflow';

export class LaunixNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Launix API',
		name: 'launixNode',
		icon: 'file:logo.svg',
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
				displayOptions: {
					show: {
						operation: [
							'create',
							'custom',
							'delete',
							'edit',
							'list',
							'view',
						],
					}
				},
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
					{ name: 'Retrieve File', value: 'retrieveFile', description: 'Download a file by ID', action: 'Retrieve a file' },
					{ name: 'Upload File', value: 'uploadFile', description: 'Upload a file from binary', action: 'Upload a file' },
					{ name: 'View', value: 'view', description: 'Retrieve an item', action: 'Retrieve an item' },
				],
				description: 'What do you want to perform on the data',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'uploadFile',
						],
					}
				},
				description: 'Name of the binary property containing the file to upload',
			},
			{
				displayName: 'File ID',
				name: 'fileId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'retrieveFile',
						],
					}
				},
				description: 'The identifier of the file to download',
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
				displayName: 'Columns',
				name: 'columns',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				required: true,
				typeOptions: {
					resourceMapper: {
						resourceMapperMethod: 'getColumns',
						mode: 'upsert',
						fieldWords: {
							singular: 'column',
							plural: 'columns',
						},
						addAllFields: true,
						multiKeyMatch: false,
						supportAutoMap: false,
					},
				},
				displayOptions: {
					show: {
						operation: [
							'create',
							'edit',
						],
					}
				},
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
			// load tables
			searchTables: async function (this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const credentials = await this.getCredentials('launixCredentialsApi');

				//const nodeOptions = this.getNodeParameter('options', 0) as IDataObject;

				const baseUrl = (credentials.baseurl as string).replace(/\/+$/, '');
				const apiinfo = await this.helpers.request(baseUrl + '/FOP/Index/api', {
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
		},
		resourceMapping: {
			// load column list of a table
			getColumns: async function (this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const credentials = await this.getCredentials('launixCredentialsApi');

				const tableId = (this.getNodeParameter('table', {}) as IDataObject).value as string;

				const baseUrl = (credentials.baseurl as string).replace(/\/+$/, '');
				const apiinfo = await this.helpers.request(baseUrl + '/FOP/Index/api', {
					method: 'GET',
					headers: {
						'Authorization': 'Bearer ' + credentials.token,
					},
					json: true
				});

				const table = apiinfo['tables'][tableId];
				if (!table) {
					return { fields: [] };
				}

				let columns: ResourceMapperField[] = [];
				for (let col in table.columns) {
					columns.push({
							id: col,
							displayName: table.columns[col].desc + ' (' + col + ')',
							required: table.columns[col].required || false,
							defaultMatch: false,
							display: true,
							type: 'string', // TODO: allow multiple types -> string, number, option
							canBeUsedToMatch: true,
							readOnly: false,
							removed: !(table.columns[col].required || false),
					});
				}

				return {
					fields: columns
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
		const baseUrl = (credentials.baseurl as string).replace(/\/+$/, '');
		const items = this.getInputData();

		let item: INodeExecutionData;
		const operation = (this.getNodeParameter('operation', 0, 'view') as string);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				item = items[itemIndex];
				// Handle special operation: retrieve file binary
				if (operation === 'retrieveFile') {
					const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
					const url = baseUrl + '/FOP/Files/' + encodeURIComponent(fileId) + '/x';
					const response = await this.helpers.request(url, {
						method: 'GET',
						headers: {
							'Authorization': 'Bearer ' + credentials.token,
						},
						json: false,
						encoding: null,
						resolveWithFullResponse: true,
					});

					const headers = response.headers || {};
					let filename = 'file_' + fileId;
					const contentDisposition: string | undefined = headers['content-disposition'] as string | undefined;
					if (contentDisposition) {
						const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
						if (match) {
							filename = decodeURIComponent(match[1] || match[2]);
						}
					}
					const contentType = (headers['content-type'] as string | undefined) || 'application/octet-stream';
					const binaryData = await this.helpers.prepareBinaryData(response.body as any, filename, contentType);
					item.binary = item.binary || {};
					item.binary['data'] = binaryData;
					item.json = { fileId, fileName: filename } as IDataObject;
					continue;
				}

				// Handle special operation: upload file from binary
				if (operation === 'uploadFile') {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex, 'data') as string;
					if (!item.binary || !item.binary[binaryPropertyName]) {
						throw new NodeOperationError(this.getNode(), `Binary property '${binaryPropertyName}' is missing on input item`, { itemIndex });
					}
					const bin = item.binary[binaryPropertyName]!;
					const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
					const filename = (bin.fileName as string) || 'upload.bin';
					const contentType = (bin.mimeType as string) || 'application/octet-stream';

					const url = baseUrl + '/FOP/Files/upload?x=-1';
					const formData: any = {
						'file_-1': {
							value: buffer,
							options: {
								filename,
								contentType,
							},
						},
					};

					const result = await this.helpers.request(url, {
						method: 'POST',
						headers: {
							'Authorization': 'Bearer ' + credentials.token,
						},
						formData,
						json: true,
					});

					if (result['error']) throw result['error'];
					item.json = { uploaded: true, result } as IDataObject;
					continue;
				}

				// Default table-based operations
				const table = (this.getNodeParameter('table', 0, {}) as IDataObject).value as string;
				let url = baseUrl + '/TablesAPI/' + table + '/' + operation;
				if (operation === 'view' || operation === 'edit' || operation === 'delete') {
					url += '?id=' + encodeURIComponent(this.getNodeParameter('id', itemIndex, '') as string);
				}
				if (operation === 'list') {
					let params = this.getNodeParameter('filterparams', itemIndex, {}) as any;
					if (typeof params === 'string') params = JSON.parse(params);
					url += '?' + Object.keys(params).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k] as string)).join('&');
				}
				const result = await this.helpers.request(url, {
					method: operation === 'edit' || operation === 'create' ? 'POST' : 'GET',
					headers: {
						'Authorization': 'Bearer ' + credentials.token,
					},
					body: operation === 'edit' || operation === 'create' ? (this.getNodeParameter('columns', itemIndex, {}) as IDataObject).value : undefined,
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
