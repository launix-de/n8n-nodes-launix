# n8n-nodes-launix

![Launix Logo](https://launix.de/launix/wp-content/uploads/2025/08/logo_space-1536x377.png)

This is an n8n community node. It lets you integrate all Launix products in your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  <!-- delete if no auth needed -->  
[Compatibility](#compatibility)  
[Usage](#usage)  <!-- delete if not using this section -->  
[Resources](#resources)  
[Version history](#version-history)  <!-- delete if not using this section -->  

## Why Choose Launix — and Why Automate with n8n?

### 🚀 A Truly Tailored ERP/CRM Ecosystem
Launix isn’t just another off-the-shelf ERP or CRM. Powered by its proprietary **Feature Oriented Programming (FOP)** tech, Launix builds systems that evolve *with your business*, not against it. Every module—from CRM to accounting to HR—is highly configurable, letting you craft exactly what your workflows need without unnecessary features. With *hundreds of reusable, modular components*, you’ll enjoy powerful functionality without the bloat.  
➡ [Learn more on launix.de](https://launix.de/launix/)

### 📦 Everything in One Place
CRM, ERP, HR, project and document management, portals, campaign workflows, and AI/KI integrations—Launix unifies them into a seamless suite. This reduces your total cost of ownership, centralizes data, and eliminates the headaches of mismatched tools.  
➡ [Discover the full suite](https://launix.de/launix/)

### 🔒 Secure, Efficient, and Scalable
Security is built-in: hashed/salted passwords, SQL injection and XSS protection, plus compliance with GoBD and GDPR. The modular architecture ensures your system grows alongside your business without costly migrations.  
➡ [Read about Launix’s architecture](https://launix.de/launix/launix-home/)

### 💬 Real Efficiency Gains
> “Thanks to Launix, we now have a proper offer and order structure. With the individual customization… we save a lot of time.”

> “With the software from Launix, things are better now.”

From replacing spreadsheet chaos to unifying contact, ticket, and call systems—Launix consistently boosts efficiency.

---

## The Magic of Pairing Launix with n8n Automation

n8n automation supercharges Launix:

- **Connect modules across the board** — trigger Launix actions automatically (create customers, send documents, update opportunities).
- **Leverage Launix’s database schemes and views** — pull live, structured data directly from Launix, process or enrich it with n8n, and feed results back automatically. This enables real-time dashboards, intelligent notifications, and complex cross-system workflows.
- **Save time with zero-code workflows** — chain actions like “new lead → CRM tag → automated email → project creation” without coding.
- **Combine custom actions** — integrate Launix’s unique capabilities (e.g., `Invoice-Send`) into multi-step workflows involving email, chat apps, or external APIs.
- **Scale complexity gradually** — start with simple automations, then expand to orchestrate advanced, multi-branch business processes.

**💡 Why it’s cool:**  
Launix gives you a flexible, database-driven backbone with rich API access. n8n acts as the automation glue, turning Launix’s structured data and actions into smart, responsive workflows. Together, they deliver unmatched efficiency, accuracy, and scalability.


## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

This node supports the following operations:

- **Batch Action** – Run a batch action (POST items)
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

