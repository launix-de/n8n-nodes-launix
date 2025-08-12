import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class LaunixCredentialsApi implements ICredentialType {
	name = 'launixCredentialsApi';
	displayName = 'Launix Credentials API';

	documentationUrl = 'https://launix.de';

	properties: INodeProperties[] = [
		// The credentials to get from user and save encrypted.
		// Properties can be defined exactly in the same way
		// as node properties.
		{
			displayName: 'Base URL of the software',
			name: 'baseurl',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Auth Token',
			name: 'token',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
	];

	// This credential is currently not used by any node directly
	// but the HTTP Request node can use it to make requests.
	// The credential is also testable due to the `test` property below
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				//baseurl: '={{ $credentials.baseurl }}',
				Authorization: '=Bearer {{ $credentials.token }}',
			}
		},
	};

	// The block below tells how this credential can be tested
	test: ICredentialTestRequest = {
		request: {
			url: '={{ $credentials.baseurl }}/FOP/Index/api',
		},
	};
}

