# Create a Guided Shopping Agent for a B2B Store

Create a Guided Shopping Agent to unlock agent capabilities in your store. Guided Shopping Agent includes standard topics, which are preconfigured categories of actions that help the agent recognize how to behave and respond for different jobs.

### Required Editions

| View supported editions. |
| --- |

1.  In your Salesforce org, click ![Setup icon](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/29108d7d-c8f2-43fe-8a99-16280680c1bb/comm/images/comm_setup_icon_no_border.png) at the top of the page, and then select **Setup**.
2.  In the Quick Find box, enter Agentforce Agents, and select **Agentforce Agents**.
3.  To create an agent, click **New Agent**.
4.  Select the Agentforce for **Guided Shopping - B2B template**, and then click **Next**.

    ![Select an agent window with Agentforce for Guided Shopping - B2B template selected.](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/29108d7d-c8f2-43fe-8a99-16280680c1bb/comm/images/comm_agent_template.jpg)

5.  On the Review Topics page, review the topics included in this template. Salesforce suggests keeping all default topics.

    The Guided Shopping Agent - B2B template includes standard topics, such as Commerce User Verification and Commerce Product Search Assistant, that you can use as a starting point for common use cases. After creating your agent, you can customize or create custom topics in Agent Builder.

6.  Click **Next**.
7.  Enter the details for your agent.

    | Name | Guided Shopping Agent |
    | --- | --- |
    | API Name | Guided_Shopping_Agent |
    | Description | Enter a description for the agent.<br>For example, Deliver personalized customer interactions with an autonomous AI agent. Agentforce Guided Shopping Agent intelligently supports your customers with common inquiries related to product and order. |
    | Role | Enter a job description for the agent. |
    | Company | Enter a description for the company that the agent represents. |
    | Agent User | Select a user or create one specifically for your agent.<br>Assign the user a permission set that contains the Agent User license. For example, if you’re creating a Service Agent, you can assign the user to the Agentforce Service Agent User permission set. |

8.  Click **Keep a record of conversations with Enhanced Event Logs to review agent behavior** so you can review and troubleshoot agent sessions. See [Enable Enhanced Event Logs](https://help.salesforce.com/s/articleView?id=ai.copilot_setup_enhanced_event_logs.htm&language=en_US&type=5).
9.  Click **Next**.
10.  Click **Create**.

     ![Customize your agent window with information for Guided Shopping Agent entered](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/29108d7d-c8f2-43fe-8a99-16280680c1bb/comm/images/comm_agent_customize_agent.jpg)

11.  (Optional). To add Guided Shopping topics to a pre-existing agent, select the agent and then click **Open in Builder**. If the agent is active, click **Deactivate**. Click **New** | **Add From Asset Library**. Select the Topics to add, and then click **Finish**.

     The B2B topics are Commerce User Verification, Commerce Order, Commerce Effective Accounts, Commerce Global Instructions, and Commerce Product Search Assistant.

12.  In Agent Builder, select the **Commerce Global Instructions** topic.
13.  Click **New Version**.
14.  Locate the instruction that begins with Always use the hardcoded value. Change the webStoreIdValue value to your store's webstore ID.

     This ID is a 15-character record ID beginning with OZE. Always use the hardcoded value '0ZExxxxxxxxxxxx' for the input webStoreId parameter in any action that requires this identifier.

     ![Commerce Global Instructions topic instruction with replaced webstore ID value](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/29108d7d-c8f2-43fe-8a99-16280680c1bb/comm/images/comm_agent_global_instructions_replace_value.jpg)

     ![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/29108d7d-c8f2-43fe-8a99-16280680c1bb/images/icon_note.png)

     Note Locate the webStoreUrl on the store's setup page in the URL. ![Location within store setup to find the store's webstore ID.](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/29108d7d-c8f2-43fe-8a99-16280680c1bb/comm/images/comm_agent_webstore_id_location.jpg)

15.  Save your work.
16.  In Agent Builder, select the **Commerce Order** topic.
17.  Click **New Version**.
18.  Locate the instruction that begins with For the cart URL. Replace {loginPageUrl}?startURL={cartPageUrl}/cart with webStoreUrl/cart, where webStoreUrl is your store's URL. For example, https://mydomain.com/store/cart.

     ![Commerce Order cart URL topic instruction replaced text with example webstore ID](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/29108d7d-c8f2-43fe-8a99-16280680c1bb/comm/images/comm_agent_cart_url_replace.jpg)

19.  Locate the instruction that begins with For the Order Url. Replace {loginPageUrl}?startURL={orderSummaryPageUrl}/orderId with webStoreUrl/orderSummary/{orderId}, where webStoreUrl is your store's URL. For example, https://mydomain.com/store/orderSummary/{orderId}.

     ![Commerce Order order URL topic instruction replaced fields with webstore ID.](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/29108d7d-c8f2-43fe-8a99-16280680c1bb/comm/images/comm_agent_replace_commerce_order_instruction_order_url.jpg)

20.  Save your work.

![Example](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/29108d7d-c8f2-43fe-8a99-16280680c1bb/images/icon_example.png)

Example A Guided Shopping agent with all the B2B Commerce topics added.

![A B2B store with all Commerce Topics added.](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/29108d7d-c8f2-43fe-8a99-16280680c1bb/comm/images/comm_agent_all_topics.jpg)

#### See Also

-   [Customize Your Agents with Topics and Actions](https://help.salesforce.com/s/articleView?id=ai.copilot_topics_actions.htm&language=en_US&type=5)
-   [Explore Standard Agent Topics and Actions](https://help.salesforce.com/s/articleView?id=ai.copilot_ref.htm&language=en_US&type=5)
-   [Add a Topic from the Asset Library](https://help.salesforce.com/s/articleView?id=ai.copilot_topics_add_standard.htm&language=en_US&type=5)
-   [Agentforce Commerce Agent Topics](https://help.salesforce.com/s/articleView?id=ai.copilot_topics_ref_agentforce_commerce_agents.htm&language=en_US&type=5)
-   [Agentforce Commerce Agent Actions](https://help.salesforce.com/s/articleView?id=ai.copilot_actions_ref_commerce_parent.htm&language=en_US&type=5)
