# Considerations for Agentforce Guided Shopping for B2B Commerce

Before setting up a guided shopping agent, consider supported functionality, usage, limitations and allowances, limits, and other issues.

### Required Editions

| View supported editions. |
| --- |

[Which Salesforce Commerce Product Do I Have?](https://help.salesforce.com/s/articleView?id=commerce.comm_what_product.htm&language=en_US&type=5)

## Language and Locale Support

Agentforce Guided Shopping Agent - B2B supports these languages and locales.

| Locale | Code |
| --- | --- |
| English (United States) | en_US |

## Large Language Model Support

Agentforce Guided Shopping Agent supports these models.

| Model |
| --- |
| OpenAI GPT-4o |

## Einstein Trust Layer Service Support

Agentforce Guided Shopping Agent supports these Trust Layer services.

| Service | Description |
| --- | --- |
| Zero Data Retention Policy | Einstein Trust Layer uses a zero-data retention policy, so no data is stored or used for model training by third-party LLMs, such as Open AI and Azure Open AI. Customers’ use of other features including agents sometimes results in data storage. For more information, contact your Salesforce account executive. |
| Dynamic Grounding with Secure Data Retrieval | Relevant information from a Salesforce record is merged with the prompt to provide context. |
| Prompt Defense (System policies and prompt injection detection) | System policies help limit hallucinations and decrease the likelihood of unintended or harmful output by the LLM. |
| Toxicity Detection | Potentially harmful LLM responses are detected and flagged. |
| Audit and Feedback | Prompts, responses, and trust signals are logged and stored in Data 360. Feedback can be used for improving prompt templates. |

Data masking through the Einstein Trust Layer is disabled to improve the performance and accuracy of agents. Ask your system administrator about which Einstein Trust Layer services are enabled in your org and available for guided shopping agents.

## Guided Shopping Agents and Einstein Requests Usage

Einstein Requests is a usage metric for generative AI. The use of generative AI capabilities, in either a production or a sandbox environment, consumes Einstein Requests and possibly Data 360 credits. See [Generative AI Billable Usage Types](https://help.salesforce.com/s/articleView?id=ai.generative_ai_usage.htm&language=en_US&type=5).

Agentforce Guided Shopping Agent is a consumption-based product that uses Einstein and stores and processes data using Data 360. ASA consumes credits used for billing based on your usage of the feature.

## Usage Types Billed by Agentforce Guided Shopping Agent

![Tip](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/29108d7d-c8f2-43fe-8a99-16280680c1bb/images/icon_tip.png)

Tip This feature has access to Digital Wallet, a free account management tool that offers near real-time consumption data for enabled products across your active contracts. Access Digital Wallet and start tracking your org's usage. To learn more, see [About Digital Wallet](https://help.salesforce.com/s/articleView?id=xcloud.wallet_about.htm&language=en_US&type=5).

| Card | Type | Description | Notes |
| --- | --- | --- | --- |
| Conversations | Agentforce: ASA Messaging | For this subtype of the Agentforce usage type, usage is calculated based on conversation windows. A conversation window starts when one of the following happens:<br>when the user sends a message for the first time after the previous conversation window ends<br>when ASA sends a pre-configured welcome message first<br>The end of the conversation window differs for each Digital Engagement channel on which ASA is enabled.<br>For the Messaging for In-App and Web channels:<br>Messaging for Web: For unauthenticated users, the conversation window ends when the user explicitly clicks End Conversation. For authenticated users, the conversation window ends 24 hours after the start of the conversation.<br>Messaging for In-App: The conversation window ends 24 hours after the start of the conversation.<br>For these channels, the conversation window ends 24 hours after the start of the conversation:<br>Enhanced WhatsApp<br>Enhanced Facebook Messenger<br>Enhanced Apple Messages for Business<br>Enhanced SMS<br>Bring Your Own Channel<br>Enhanced LINE | Agentforce Guided Shopping Agent (ASA) supports only inbound conversations, which are conversations that a user initiates. See Generative AI Billable Usage Types. |
| Einstein Requests | Einstein Requests | Einstein Requests is a usage metric for generative AI. The use of generative AI capabilities, in either a production or a sandbox environment, consumes Einstein Requests and possibly Data 360 credits. To learn more, see Data 360 Billable Usage Types.<br>API calls to the LLM gateway use Einstein Requests. For each API call to the LLM gateway, the number of Einstein requests used depends on the API call size factor and the LLM usage type multiplier. To learn more, see the Rate Card for Einstein Requests.<br>Einstein Requests are available in:<br>Enterprise, Performance, and Unlimited editions with an Einstein for Sales, Einstein for Platform, or Einstein for Service add-on. To purchase the Einstein for Sales, Einstein for Platform, or Einstein for Service add-on, contact your Salesforce account executive.<br>All Einstein 1 Editions<br>Marketing Cloud - Growth - Enterprise Edition and Marketing Cloud - Growth - Unlimited Edition | See Generative AI Billable Usage Types. |
| Data Services Credits | Batch Data Pipeline | Usage is calculated based on the amount of batch data processed by Data 360 data streams across all connectors. |  |
| Data Services Credits | Data Queries | Usage is calculated based on the number of records processed.<br>The count of records processed depends on the structure of a query as well as other related factors, such as the total number of records in the objects being queried. |  |
| Data Services Credits | Unstructured Data Processed | Usage is calculated based on the amount of unstructured data that is processed. For example, if the search index processes 100 PDF documents that are 1 MB each, usage is calculated as 100 MB. If the search index processes five audio/video files that are on average 100MB each, usage is calculated as 500MB.<br>In Data 360, unstructured data is sometimes chunked and vectorized using an embedding model. Usage is computed only once across both these activities. For example, if one 100 MB PDF document is chunked and vectorized, usage is computed as 100 MB, not as 200MB. |  |
| Data Storage | Storage Beyond Allocation | Usage is calculated based on the amount of storage used above the amount allocated. | Storage refers to the amount of data stored in Data 360. Storage used outside of Data 360, such as data stored on the Salesforce Lightning Platform, isn't counted toward this limit. Data you ingest into Data 360 for Agentforce Guided Shopping Agents conversations is counted toward your storage allocation. If you use more data than allocated, usage is charged. |
| Flex Credits | Standard Action | Usage is determined by the number of standard agent actions. Each standard agent action includes the processing of up to 10,000 tokens. Tokens are units of data processed by AI models. Actions exceeding this limit are counted as a separate standard action each time the 10,000 token limit is exceeded. For example, processing 20,001 tokens is 3 standard actions. Actions involving lengthy prompts sent to the LLM can be counted as multiple actions where the 10,000 tokens per action limit is exceeded.<br>Standard agent actions are actions that are available out-of-the-box. To check the list of Standard actions, see Standard Action Reference.<br><br>Note Use of some standard agent actions require that a subscription has been purchased for each user that accesses these actions, such as a subscription to Agentforce for Sales Add-on or Agentforce for Service Add-on. To determine which subscription is required for such standard actions, see Standard Action Reference at Standard Action Reference. While this requirement is not technically enforced yet, users who don’t have the required add-on license will lose access to such actions for which they don’t have a license when the requirement is enforced. |  |
| Flex Credits | Custom Action | Usage is determined by the number of custom actions. Each custom action includes the processing of up to 10,000 tokens. Tokens are units of data processed by AI models. Actions exceeding this limit are counted as a new custom action each time the 10,000 token limit is exceeded. For example, processing 20,001 tokens is 3 custom actions. Actions involving lengthy prompts sent to the LLM can be counted as multiple actions where the 10,000 token action per limit is exceeded.<br>Custom actions are actions that are created by you or which result from your modification of a standard action. To learn more about what customer created actions are, see Create a Custom Agent Action. To learn more about how standard actions become custom actions, see Editing Standard Agent Action Reference Actions. |  |

## Guided Shopping Agent Limits

-   Your Salesforce org can have no more than 100 active agents at a time. See [Activate or Deactivate your Agent](https://help.salesforce.com/s/articleView?id=ai.copilot_setup_activate_deactivate.htm&language=en_US&type=5).
-   Agentforce Guided Shopping Agent supports multiple stores.
-   When an incoming customer message exceeds the character limits of the messaging channel, the message isn’t delivered, and no response is generated. Different messaging channels have different character limits.
    -   Facebook allows up to 2,000 characters.
    -   LINE allows up to 5,000 characters.
    -   SMS allows up to 912 characters, but if the message includes special characters, this limit decreases to 396 characters.
    -   WhatsApp allows up to 4,096 characters.
    -   Apple Messages for Business allows up to 50,000 characters.

## Other Considerations

-   You can create multiple versions of an agent. See [Manage Agent Versions](https://help.salesforce.com/s/articleView?id=ai.agent_versions.htm&language=en_US&type=5).
-   Currently, Agentforce Guided Shopping doesn't support these standard topics:
    -   General CRM
    -   Single Record Summary
-   Curently, Agentforce Guided Shopping doesn't support these standard actions;
    -   Identify Object by Name
    -   Identify Record by Name
    -   Query Records
    -   Query Records With Aggregate
    -   Summarize Record
    -   Draft or Revise Email
    -   Update Record Fields
    -   Extract Fields And Values From User Input
-   The APIs required to connect Data 360 to Guided Shopping agents are compatible only with the default dataspace.
-   Agentforce is included as a Covered Service in the Einstein Platform and Agentforce SOC 2 and SOC 3 reports. Agentforce is HIPAA eligible and covered under the Salesforce [Business Associate Addendum Restrictions](https://www.salesforce.com/company/legal/business-associate-addendum-restrictions/) and has also achieved ISO 27001, 27017, and 27018 certifications.

#### See Also

-   [Einstein Audit and Feedback Data](https://help.salesforce.com/s/articleView?id=ai.generative_ai_feedback.htm&language=en_US&type=5)
-   [Einstein Generative AI Supported Languages and Locales](https://help.salesforce.com/s/articleView?id=ai.generative_ai_platform_languages.htm&language=en_US&type=5)
-   [Large Language Model Support](https://help.salesforce.com/s/articleView?id=ai.generative_ai_large_language_model_support.htm&language=en_US&type=5)
-   [Einstein Trust Layer](https://help.salesforce.com/s/articleView?id=ai.generative_ai_trust_layer.htm&language=en_US&type=5)
