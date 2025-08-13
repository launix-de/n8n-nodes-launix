# n8n-nodes-launix

This is an n8n community node. It lets you integrate all Launix products in your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  <!-- delete if no auth needed -->  
[Compatibility](#compatibility)  
[Usage](#usage)  <!-- delete if not using this section -->  
[Resources](#resources)  
[Version history](#version-history)  <!-- delete if not using this section -->  

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

This node supports the following operations:

- **Create** – Insert a new record  
- **Custom Action** – Run a custom action (e.g., `Invoice-Send`)  
- **Delete** – Permanently delete a record  
- **Edit** – Update an existing record  
- **List** – Retrieve a list of records  
- **View** – Retrieve a single record  

## Credentials

To use this node, you need **Launix API credentials**.

1. Log into your Launix product (e.g., ERP system).
2. Create an API user or use your admin account. Obtain an API key in the user settings.  
3. Copy the base URL from your launix product (e.g. https://demo2.launix.de/)
3. Enter these details into n8n credentials of type **Launix Credentials API**. 

## Compatibility

- **Minimum n8n version:** 1.106.3
- Tested with: 1.106.3
- No known incompatibility issues.

## Usage

Once your credentials are set up, you can use the Launix node in your workflows to perform CRUD operations and special actions with your Launix products.  
Tip: For complex workflows, you can chain multiple Launix nodes (e.g., Launix: fetch data → filter for empty values → AI workflow → Launix: edit).

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)  
- [Launix website](https://launix.de)

## Version history

- **1.0.0** – Initial release: all CRUD operations supported


