import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodePropertyOptions,
	ResourceMapperFields,
	ResourceMapperField,
} from 'n8n-workflow';
import FormData from 'form-data';

export class LaunixNode implements INodeType {

	description: INodeTypeDescription = ({
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
							'delete',
							'edit',
							'list',
							'view',
							'custom',
						],
					}
				},
			},
			{
				displayName: 'Action',
				name: 'customAction',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'Action',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchCustomActions',
							searchable: true,
						},
					},
				],
				typeOptions: {
					loadOptionsDependsOn: ['table.value'],
				},
				displayOptions: {
					show: {
						operation: [
							'custom',
						],
					}
				},
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Action Parameters',
				name: 'actionParams',
				type: 'resourceMapper',
				noDataExpression: true,
				default: { mappingMode: 'defineBelow', value: null },
				typeOptions: {
					loadOptionsDependsOn: ['table.value', 'customAction.value'],
					resourceMapper: {
						resourceMapperMethod: 'getActionParams',
						mode: 'upsert',
						fieldWords: { singular: 'parameter', plural: 'parameters' },
						addAllFields: false,
						multiKeyMatch: false,
						supportAutoMap: false,
					},
				},
				displayOptions: { show: { operation: ['custom'] } },
				description: 'Provide values for the action\'s parameters as defined by the API descriptor',
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
							'custom',
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
					loadOptionsDependsOn: ['table.value', 'operation'],
					resourceMapper: {
						resourceMapperMethod: 'getColumns',
						mode: 'add',
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
	} as unknown as INodeTypeDescription);

	methods = {
		listSearch: {
			// load tables
			searchTables: async function (this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const credentials = await this.getCredentials('launixCredentialsApi');

				//const nodeOptions = this.getNodeParameter('options', 0) as IDataObject;

				const baseUrl = (credentials.baseurl as string).replace(/\/+$/, '');
				const apiinfo = await this.helpers.httpRequestWithAuthentication.call(this, 'launixCredentialsApi', {
					method: 'GET',
					url: baseUrl + '/FOP/Index/api',
					json: true,
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
			,
			// load actions for selected table
			searchCustomActions: async function (this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const credentials = await this.getCredentials('launixCredentialsApi');
				const tableParam = this.getNodeParameter('table', 0, {}) as IDataObject;
				const tableId = (tableParam as any).value as string;
				if (!tableId) return { results: [] };
				const baseUrl = (credentials.baseurl as string).replace(/\/+$/, '');
				const apiinfo = await this.helpers.httpRequestWithAuthentication.call(this, 'launixCredentialsApi', {
					method: 'GET',
					url: baseUrl + '/FOP/Index/api',
					json: true,
				});

				const table = apiinfo['tables'][tableId];
				if (!table) return { results: [] };
				const actions = (table.actions || []) as Array<any>;
				const results = actions
					.filter((a: any) => {
						const label = (a.title || a.path || '').toString();
						return !filter || label.toUpperCase().includes(filter.toUpperCase());
					})
					.map((a: any) => ({ name: (a.title || a.path || ''), value: a.path }));
				return { results };
			}
		},
		resourceMapping: {
			// load column list of a table
			getColumns: async function (this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const credentials = await this.getCredentials('launixCredentialsApi');

				// Read the currently selected table for this node; ensure we use index 0 in load options context
				const tableParam = this.getNodeParameter('table', 0, {}) as IDataObject;
				const tableId = (tableParam as any).value as string;

				const baseUrl = (credentials.baseurl as string).replace(/\/+$/, '');
				const apiinfo = await this.helpers.httpRequestWithAuthentication.call(this, 'launixCredentialsApi', {
					method: 'GET',
					url: baseUrl + '/FOP/Index/api',
					json: true,
				});

				const table = apiinfo['tables']?.[tableId];
				if (!table) {
					return { fields: [] };
				}

				const operation = this.getNodeParameter('operation', 'view') as string;
				const isCreate = operation === 'create';

				const normalizeColumns = (tableColumns: unknown): Array<[string, IDataObject]> => {
					if (!tableColumns) {
						return [];
					}
					if (Array.isArray(tableColumns)) {
						return (tableColumns as Array<IDataObject>)
							.filter((col) => typeof col === 'object' && col && typeof col['id'] === 'string')
							.map((col) => [col['id'] as string, col]);
					}
					return Object.entries(tableColumns as Record<string, IDataObject>);
				};

				const coerceNumber = (value: unknown): number | undefined => {
					if (typeof value === 'number' && Number.isFinite(value)) {
						return value;
					}
					if (typeof value === 'string' && value.trim() !== '') {
						const parsed = Number(value);
						if (Number.isFinite(parsed)) {
							return parsed;
						}
					}
					return undefined;
				};

				const ensureOptionValue = (
					value: unknown,
					preferNumeric: boolean,
				): string | number | boolean => {
					if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
						return value;
					}
					if (preferNumeric) {
						const numeric = coerceNumber(value);
						if (numeric !== undefined) {
							return numeric;
						}
					}
					return String(value ?? '');
				};

				const toDisplayString = (value: unknown): string => {
					if (value === null || value === undefined) {
						return '';
					}
					if (typeof value === 'object') {
						try {
							return JSON.stringify(value);
						} catch {
							return String(value);
						}
					}
					return String(value);
				};

				const buildStaticOptions = (
					rawOptions: unknown,
					preferNumeric: boolean,
				): INodePropertyOptions[] => {
					if (!rawOptions) {
						return [];
					}
					const options: INodePropertyOptions[] = [];
					if (Array.isArray(rawOptions)) {
						rawOptions.forEach((entry, index) => {
							if (entry && typeof entry === 'object') {
								const name = toDisplayString((entry as IDataObject).name ?? (entry as IDataObject).label ?? (entry as IDataObject).desc ?? (entry as IDataObject).value ?? index);
								const value = ensureOptionValue(
									(entry as IDataObject).value ?? (entry as IDataObject).id ?? (entry as IDataObject).key ?? (preferNumeric ? index : name),
									preferNumeric,
								);
								options.push({ name, value });
							} else {
								const name = toDisplayString(entry);
								const fallbackValue = preferNumeric ? coerceNumber(entry) ?? index : entry;
								options.push({
									name,
									value: ensureOptionValue(fallbackValue, preferNumeric),
								});
							}
						});
					} else if (typeof rawOptions === 'object') {
						Object.entries(rawOptions as Record<string, unknown>).forEach(([key, label]) => {
							const value = preferNumeric ? coerceNumber(key) ?? key : key;
							options.push({
								name: toDisplayString(label ?? key),
								value: ensureOptionValue(value, preferNumeric),
							});
						});
					}
					return options;
				};

				const extractRecords = (response: unknown): IDataObject[] => {
					if (!response) {
						return [];
					}
					if (Array.isArray(response)) {
						return response as IDataObject[];
					}
					if (typeof response === 'object') {
						const dataObject = response as IDataObject;
						const candidates = ['data', 'items', 'records', 'results', 'list'];
						for (const key of candidates) {
							const candidate = dataObject[key];
							if (Array.isArray(candidate)) {
								return candidate as IDataObject[];
							}
						}
					}
					return [];
				};

				const findReadableString = (input: unknown, depth = 0): string | undefined => {
					if (depth > 4 || input === undefined || input === null) {
						return undefined;
					}
					if (typeof input === 'string') {
						const trimmed = input.trim();
						return trimmed ? trimmed : undefined;
					}
					if (typeof input === 'number' || typeof input === 'boolean') {
						return String(input);
					}
					if (Array.isArray(input)) {
						for (const entry of input) {
							const value = findReadableString(entry, depth + 1);
							if (value) {
								return value;
							}
						}
						return undefined;
					}
					if (typeof input === 'object') {
						const preferredKeys = [
							'name',
							'Name',
							'title',
							'Title',
							'label',
							'Label',
							'desc',
							'Desc',
							'description',
							'Description',
							'text',
							'code',
							'value',
							'slug',
							'short',
							'long',
						];
						const objectInput = input as IDataObject;
						for (const key of preferredKeys) {
							if (objectInput[key] !== undefined) {
								const value = findReadableString(objectInput[key], depth + 1);
								if (value) {
									return value;
								}
							}
						}
						for (const value of Object.values(objectInput)) {
							const readable = findReadableString(value, depth + 1);
							if (readable) {
								return readable;
							}
						}
					}
					return undefined;
				};

				// Derive a display label and identifier from arbitrary list payloads.
				const mapRecordToOption = (record: IDataObject): INodePropertyOptions | null => {
					if (!record) {
						return null;
					}
					const valueCandidates = ['id', 'ID', 'Id', 'value', 'key'];
					let optionValue: unknown;
					for (const key of valueCandidates) {
						if (record[key] !== undefined && record[key] !== null) {
							optionValue = record[key];
							break;
						}
					}
					if (optionValue === undefined) {
						const fallbackKeys = Object.keys(record);
						optionValue = fallbackKeys.length ? record[fallbackKeys[0]] : undefined;
					}
					if (optionValue === undefined) {
						return null;
					}
					const labelCandidates = ['name', 'Name', 'title', 'Title', 'label', 'Label', 'desc', 'Desc', 'description', 'Description'];
					let optionLabel: unknown;
					for (const key of labelCandidates) {
						if (record[key] !== undefined && record[key] !== null) {
							optionLabel = record[key];
							break;
						}
					}
					let readableLabel = findReadableString(optionLabel);
					if (!readableLabel) {
						readableLabel = findReadableString(record);
					}
					const normalizedValue = ensureOptionValue(optionValue, true);
					const valueAsString = toDisplayString(normalizedValue);
					let name = readableLabel || valueAsString;
					if (!name) {
						name = valueAsString || ''; // final fallback
					}
					if (valueAsString && name && !name.includes(valueAsString)) {
						name = `${name} (${valueAsString})`;
					}
					return {
						name,
						value: normalizedValue,
					};
				};

				const loadReferenceOptions = async (
					referenceTable: string,
				): Promise<INodePropertyOptions[]> => {
					try {
						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'launixCredentialsApi', {
							method: 'POST',
							url: `${baseUrl}/TablesAPI/${encodeURIComponent(referenceTable)}/list`,
							json: true,
							body: {},
						});
						const rows = extractRecords(response).slice(0, 200);
						const seen = new Set<string | number | boolean>();
						const options: INodePropertyOptions[] = [];
						for (const row of rows) {
							const option = mapRecordToOption(row);
							if (!option) {
								continue;
							}
							if (seen.has(option.value)) {
								continue;
							}
							seen.add(option.value);
							options.push(option);
						}
						return options;
					} catch {
						return [];
					}
				};

				const columnEntries = normalizeColumns(table.columns);
				const fields: ResourceMapperField[] = [];
				for (const [columnId, columnMeta] of columnEntries) {
					const columnInfo = columnMeta as IDataObject;
					const baseRequired = (columnInfo.required as boolean) || false;
					const required = isCreate && baseRequired;
					const rawType = columnInfo.type;
					const resolvedType = typeof rawType === 'object' && rawType !== null ? (rawType as IDataObject) : { type: rawType };
					const infoText = typeof resolvedType['info'] === 'string' ? (resolvedType['info'] as string) : undefined;
					const typeNameRaw = (resolvedType['type'] ?? rawType ?? 'string') as string;
					const typeName = typeof typeNameRaw === 'string' ? typeNameRaw.toLowerCase() : 'string';
					let fieldType: ResourceMapperField['type'] = 'string';
					let options: INodePropertyOptions[] = [];

					const staticOptions = buildStaticOptions(resolvedType['options'], typeName === 'number');
					if (staticOptions.length) {
						options = staticOptions;
					}

					if (typeName === 'number') {
						fieldType = options.length ? 'options' : 'number';
					} else if (typeName === 'boolean') {
						fieldType = 'boolean';
					} else if (typeName === 'date' || typeName === 'datetime') {
						fieldType = 'dateTime';
					} else if (typeName === 'time') {
						fieldType = 'time';
					} else if (typeName === 'foreign-key' || typeName === 'reference') {
						const referenceTable = resolvedType['references'] ? String(resolvedType['references']) : '';
						if (referenceTable) {
							options = await loadReferenceOptions(referenceTable);
						}
						fieldType = 'options';
					} else if (options.length) {
						fieldType = 'options';
					} else {
						fieldType = 'string';
					}

					const baseLabel = `${columnInfo.desc || columnId} (${columnId})`;
					const displayName = infoText ? `${baseLabel}: ${infoText}` : baseLabel;

					const field = {
						id: columnId,
						displayName,
						required,
						defaultMatch: false,
						display: true,
						type: fieldType,
						canBeUsedToMatch: true,
						readOnly: false,
						removed: !required,
					} as ResourceMapperField & { description?: string };
					if (fieldType === 'options') {
						field.options = options;
					}
					if (infoText) {
						field.description = infoText;
					}
					fields.push(field);
				}

				return {
					fields,
				};
			},
			// load param list for a selected custom action
			getActionParams: async function (this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const credentials = await this.getCredentials('launixCredentialsApi');
				const tableParam = this.getNodeParameter('table', 0, {}) as IDataObject;
				const tableId = (tableParam as any).value as string;
				const actionParam = this.getNodeParameter('customAction', 0, {}) as IDataObject;
				const selectedPath = (actionParam as any).value as string;
				const baseUrl = (credentials.baseurl as string).replace(/\/+$/, '');
				const apiinfo = await this.helpers.httpRequestWithAuthentication.call(this, 'launixCredentialsApi', {
					method: 'GET',
					url: baseUrl + '/FOP/Index/api',
					json: true,
				});

				const actionMeta = (apiinfo.tables?.[tableId]?.actions || []).find((a: any) => a.path === selectedPath) || { params: [] };
				const fields: ResourceMapperField[] = (actionMeta.params || []).map((p: string) => ({
					id: p,
					displayName: p,
					required: false,
					defaultMatch: false,
					display: true,
					type: 'string',
					canBeUsedToMatch: false,
					readOnly: false,
					removed: false,
				}));
				return { fields };
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
					const url = baseUrl + '/files/' + encodeURIComponent(fileId) + '/x';
					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'launixCredentialsApi', {
						method: 'GET',
						url,
						json: false,
						encoding: 'arraybuffer',
						returnFullResponse: true,
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
					const form = new FormData();
					form.append('file_-1', buffer, { filename, contentType });

					const result = await this.helpers.httpRequestWithAuthentication.call(this, 'launixCredentialsApi', {
						method: 'POST',
						url,
						body: form,
						json: true,
					});

					if (result['error']) throw result['error'];
					item.json = { uploaded: true, result } as IDataObject;
					continue;
				}

				// Default table-based operations
				const table = (this.getNodeParameter('table', 0, {}) as IDataObject).value as string;
				if (operation === 'custom') {
					// Selected action path from resource locator (e.g., "Tables/Brief/pdf")
					const actionParam = this.getNodeParameter('customAction', itemIndex, {}) as IDataObject;
					const actionPath = (actionParam as any).value as string;
					// User-provided parameter values for the action
					const actionParamsWrapper = this.getNodeParameter('actionParams', itemIndex, { value: {} }) as IDataObject;
					const actionParams = ((actionParamsWrapper as any).value || {}) as Record<string, string | number | boolean>;
					// Fallback for common param 'id'
					const id = this.getNodeParameter('id', itemIndex, '') as string;

					// Load API descriptor to resolve method and expected params for the action
					let httpMethod = 'GET';
					let expectedParams: string[] = [];
					try {
						const apiinfo = await this.helpers.httpRequestWithAuthentication.call(this, 'launixCredentialsApi', {
							method: 'GET',
							url: baseUrl + '/FOP/Index/api',
							json: true,
						});
						// Resolve table class key if user provided tblname/descSingle via expression
						let tableKey = table;
						if (!apiinfo.tables?.[tableKey]) {
							for (const [k, t] of Object.entries(apiinfo.tables || {})) {
								if ((t as any)?.tblname?.toLowerCase() === String(table).toLowerCase() || (t as any)?.descSingle?.toLowerCase() === String(table).toLowerCase()) {
									tableKey = k;
									break;
								}
							}
						}
						const tableActions = (apiinfo.tables?.[tableKey]?.actions || []) as Array<any>;
						const meta = tableActions.find((a: any) => a.path === actionPath);
						if (meta) {
							httpMethod = (meta.httpMethod || 'GET').toUpperCase();
							expectedParams = Array.isArray(meta.params) ? meta.params : [];
						}
					} catch (e) {
						// Ignore descriptor load failure; proceed with defaults
					}

					// Build final params honoring descriptor order; include id fallback if declared but not supplied
					const finalParams: Record<string, string> = {};
					for (const p of expectedParams) {
						if (p in actionParams && actionParams[p] !== undefined && actionParams[p] !== null) {
							finalParams[p] = String(actionParams[p] as any);
						} else if (p === 'id' && id) {
							finalParams[p] = String(id);
						}
					}
					// Also merge any extra provided params not in descriptor (be permissive)
					for (const [k, v] of Object.entries(actionParams)) {
						if (!(k in finalParams) && v !== undefined && v !== null) finalParams[k] = String(v as any);
					}
					// Ensure id present if no descriptor but node has it
					if (!('id' in finalParams) && id) finalParams['id'] = String(id);

					// Compose request
					const path = '/' + String(actionPath).replace(/^\/+/, '');
					let url = baseUrl + path;
					const method = httpMethod || 'GET';

					const requestOptions: any = {
						method,
						headers: { 'Authorization': 'Bearer ' + credentials.token },
						json: false,
						encoding: null,
						resolveWithFullResponse: true,
					};
					if (method === 'GET') {
						const qs = Object.keys(finalParams)
							.map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(finalParams[k] ?? ''))
							.join('&');
						if (qs) url += (url.includes('?') ? '&' : '?') + qs;
					} else {
						// For non-GET, send JSON body when possible
						requestOptions.json = true;
						requestOptions.body = finalParams;
					}

					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'launixCredentialsApi', {
						...requestOptions,
						url,
						returnFullResponse: true,
					});
					const headers = (response.headers || {}) as any;
					const contentType = (headers['content-type'] as string | undefined) || '';
					if (/application\/pdf/i.test(contentType)) {
						// Try to infer a filename
						let filename = `${table}_${finalParams['id'] || 'action'}_${actionPath.split('/').pop()}.pdf`;
						const cd: string | undefined = headers['content-disposition'] as string | undefined;
						if (cd) {
							const m = /filename\*=UTF-8''([^;]+)|filename=\"?([^";]+)\"?/i.exec(cd);
							if (m) filename = decodeURIComponent(m[1] || m[2]);
						}
						const binaryData = await this.helpers.prepareBinaryData(response.body as any, filename, 'application/pdf');
						item.binary = item.binary || {};
						item.binary['data'] = binaryData;
						item.json = { ok: true, fileName: filename, url } as IDataObject;
					} else if (/application\/json/i.test(contentType)) {
						try {
							const json = JSON.parse(response.body?.toString() || '{}');
							item.json = json as IDataObject;
						} catch {
							item.json = { ok: true, status: response.statusCode, contentType, url } as IDataObject;
						}
					} else {
						item.json = { ok: true, status: response.statusCode, contentType, url } as IDataObject;
					}
					continue;
				}

				let url = baseUrl + '/TablesAPI/' + table + '/' + operation;
				if (operation === 'view' || operation === 'edit' || operation === 'delete') {
					url += '?id=' + encodeURIComponent(this.getNodeParameter('id', itemIndex, '') as string);
				}
				if (operation === 'list') {
					let params = this.getNodeParameter('filterparams', itemIndex, {}) as any;
					if (typeof params === 'string') params = JSON.parse(params);
					url += '?' + Object.keys(params).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k] as string)).join('&');
				}
				const result = await this.helpers.httpRequestWithAuthentication.call(this, 'launixCredentialsApi', {
					method: operation === 'edit' || operation === 'create' ? 'POST' : 'GET',
					url,
					body: operation === 'edit' || operation === 'create' ? (this.getNodeParameter('columns', itemIndex, {}) as IDataObject).value : undefined,
					json: true,
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
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: { item: itemIndex } });
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
