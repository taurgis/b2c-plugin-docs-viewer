# Using Site Import/Export for Development Testing in B2C Commerce

When multiple developers work on one or more sites, it's necessary to ensure that they all have the same data in their systems. They can use Site Import/Export to set up multiple sandboxes with the same configuration. This topic applies to B2C Commerce.

### Required Editions

| Available in: B2C Commerce |
| --- |

Sometimes, developers want to import some of the data from production into the sandbox. Sometimes, importing all the site information from production isn’t desirable for security or other reasons. For example, a merchant doesn’t want a developer to import customer data for security reasons. In this case, they can use Site Import/Export to export only the portion of the site data that is available.

Site Import/Export is only intended for setting up identical sites (same names and IDs) and the same organization-level data across instances. However, the Business Manager UI also lets you export a subset of the instance data.

![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/beac8152-03cc-40b1-b594-e8ed108b8b62/images/icon_note.png)

Note You can import orders during site import on sandboxes. To use this feature, save a file called order.xml in the site's import folder. The file structure must conform to order.xsd. This feature is only available on sandboxes and is intended for (automatic) testing purposes.

1.  Log in to Business Manager with an account that has import and export privileges for the site. Administrators can check account privileges by selecting **Administration** | **Organization** | **Roles and Permissions**.
2.  Select **Administration** | **Site Development** | **Site Import & Export**.
3.  In the Export field, enter a name for your export file. Enter a name, not a path.

    We recommend that you use the following syntax:

    *yyyymmdd*\-*ModuleNames*\-*version*

    For example: 20101231-Catalogs-Pricebooks-17-1

4.  Check the **Save in the global export directory** box.
5.  Check the boxes for data you want to export.
6.  In the Export field, click **Export.**
7.  Check the Status section of the page for your export process. It includes the name of the export file you provided in parentheses. For example, `Site Export (preferences)` produces a `preferences.zip` file. When the status for your process indicates success, refresh the page. The name of your export file appears in the list of files under the Import section of the page.
8.  In the Import section, select your export file and click **Import** to download the file.

If an instance export or backup fails for any reason, the system still generates a .zip file, but appends the suffix "-invalid" to the filename. Salesforce recommends that you establish a mechanism to detect if an invalid file is produced.
