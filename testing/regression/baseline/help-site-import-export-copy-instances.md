# Using Site Import/Export to Copy Instances and Development Testing in B2C Commerce

You can use site import and export to populate a new sandbox instance with data from an existing instance. This topic applies to B2C Commerce.

You can use Site Import/Export to export SiteGenesis from one instance and then import it into a sandbox. You can then view the site as you customize the code or change configuration settings. Even if you don't intend to use most of the pages in SiteGenesis, you can export the site configuration settings so that you don't have to set them all manually. It's now possible to export portions of site-specific data, such as job schedules, through Site Import/Export. However, this data can only be imported into a site with the same name on another instance, not into a different site on the same instance.

Site Import/Export is only intended for setting up identical sites (same names and IDs) and the same organization-level data across instances. However, the Business Manager UI also lets you export a subset of the instance data.

![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/beac8152-03cc-40b1-b594-e8ed108b8b62/images/icon_note.png)

Note Scheduled execution of custom jobs is disabled for sandboxes. If you export a production or staging instance and import it into a sandbox, you can prevent accidentally running jobs that affect staging or production systems. However, you can run jobs manually on sandboxes. We recommend caution if you haven’t examined the job configuration to make sure it doesn't affect other instances.

## Export a Site

Export a site from an existing instance to populate a sandbox with data from the instance.

### Required Editions

| Available in: B2C Commerce |
| --- |

1.  Log in to Business Manager with an account that has import/export privileges for the site.

    Administrators can check account privileges by selecting **Administration** | **Organization** | **Roles and Permissions**

2.  Select **Administration** | **Site Development** | **Site Import & Export**.
3.  In the Export field, enter a name for your export file.

    Enter a name, not a path. We recommend that you use the following syntax:

    Full Version:

    `*yyyymmdd*-Full-*version*`

    For example: `20120103-Full-12.1`

    Modules:

    `*yyyymmdd*-ModuleNames-*version*`

    For example: `20120103-Full-12.1`

4.  Select the data you want to export. If you’re exporting SiteGenesis, select all data except users, so that you don't overwrite the users and permissions in the sandboxes.

    ![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/beac8152-03cc-40b1-b594-e8ed108b8b62/images/icon_note.png)

    Note If you select the option Save in Global Export Directory, be aware that for Sandboxes, data is available to other Sandboxes in the SIG. For Production, Development, or Staging, data is available to other instances in the PIG.

    1.  Under Data Units to Export, select all categories except Global data of Sites.
    2.  Under Global data of Sites, select all categories except Users and Access Roles.

        If you don't deselect the categories described, you can overwrite the users and permissions of the target site with those of the site you exported from.

5.  In the Export field, click **Export.**
6.  Log out of the instance and log in to the instance where you want to import the data.

The system generates a .zip file containing the site export. If an instance export or backup fails for any reason, the system generates a .zip file, but appends the suffix "-invalid" to the filename. We recommend that you establish a mechanism to detect when an invalid file is produced.

See Also: [Global exports from Commerce Cloud B2C platform PIG instances do not appear in SIG instances](https://help.salesforce.com/s/articleView?id=002326272&language=en_US&type=1)

## Import a Site

To import a site, first upload the .zip file onto B2C Commerce and then import it into the instance database.

### Required Editions

| Available in: B2C Commerce |
| --- |

![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/beac8152-03cc-40b1-b594-e8ed108b8b62/images/icon_note.png)

Note You can import orders during site import on sandboxes. To use this feature, save a file called order.xml in the site's import folder. The file structure must conform to order.xsd. This feature is only available on sandboxes and is intended for (automatic) testing purposes.

1.  Log in to Business Manager with an account that has import and export privileges for the site. Administrators can check account privileges by selecting **Administration** | **Organization** | **Roles and Permissions**.
2.  Select **Administration** | **Site Development** | **Site Import & Export**.
3.  In the Import section, select where you’re importing the site from.

    -   **Local:** upload the site .zip file from your local machine.
    -   **Remote:** upload the site .zip file from a remote networked machine.

        The remote import supports archive sizes up to 50 GB.

4.  Click **Choose File,** select the site zip file you want to upload, click **Open** and click **Upload.**

    The name of the .zip file appears in the grid when the zip file is successfully uploaded.

5.  In the Select column, select the .zip file and click **Import.**
6.  To import the selected archive, click **OK.**

To check the status in the Status section of the page. If the site has imported successfully, the status is set to Success. Otherwise, the status indicates if there are errors. Click the process link to see a log with information on any errors.

See Also: [Global exports from Commerce Cloud B2C platform PIG instances do not appear in SIG instances](https://help.salesforce.com/s/articleView?id=002326272&language=en_US&type=1)
