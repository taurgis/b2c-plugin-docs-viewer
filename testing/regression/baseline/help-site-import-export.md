# Site Import/Export in B2C Commerce

The site.xsd schema file describes the structure of data that is exported from an instance to a zip file, or imported from a .zip file. The site.xsd file describes all site-related data and global, non-site-related data (that is, organization-level data, such as shipping methods). This topic applies to B2C Commerce.

![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/beac8152-03cc-40b1-b594-e8ed108b8b62/images/icon_note.png)

Note Don't use special characters, such as umlauts, in file names—including names of image files—because doing so causes site import/export to fail.

Site export exports certain objects (including database objects and static files) and stores them in a single .zip file, which is available for download. You can upload the zip file to another instance and import it there. Site import is possible only if there’s no custom site in the instance.

![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/beac8152-03cc-40b1-b594-e8ed108b8b62/images/icon_note.png)

Note Code (cartridges) isn't part of the Site import/export and must be dealt with separately.

To access Site Import Export, select **Administration** | **Site Development** | **Site Import & Export**.

You can use Site Import/Export as follows:

| Mode | Purpose | Included Data |
| --- | --- | --- |
| Import | Initial Instance Setup. You can "clone" an instance. This approach is most helpful during development to initialize a developer's instance or a testing instance. (You can use Site Import to set up an initial "staging" instance, but then the import won’t be used again in a primary instance group.) | Initial global data (site independent) such as:<br>Global preferences as locales, instance time zones<br>Global custom objects<br>Schedules<br>System object attribute extensions<br>Custom object types<br>Custom preference type definitions<br>Catalogs and price books<br>Site data including business objects as:<br>Custom objects<br>Content library, assets, and images<br>Customer groups<br>Customer lists<br>Shipping, tax and payment configuration<br>Inventory<br>Stores<br>Site preferences<br>Search configuration<br>Source Codes<br>Site relations data such as Catalog-Site assignments |
| Export | Archiving Instance Data | All instance data comprising all sites and corresponding business objects and global data is exported. |
| Export | Particular Instance Data | Selective site and instance data. A user can choose between<br>Sites - you can also select individual types of site-specific data to export.<br>Libraries / Library Static Resources<br>Catalogs / Catalog Static Resources<br>Price Books<br>Inventory Lists<br>Customer Lists<br>Global data (Custom Objects, Attribute Definitions, Custom Preferences, Schedules, Custom Quota Settings) |
| Export/ import | Copying an entire Instance | B2C Commerce customization projects often involve several development teams working in parallel on different development instances. The Site import/export lets them share instance configurations and data across multiple instances.<br>Site import/export lets them save a snapshot (configuration and data) of an instance and restore it on the same or another instance. This feature can also be used for instance configuration versioning. |
| Export/ import | Copying specific site data for testing | When testing new code or troubleshooting a problem, it can be necessary to export data from a production instance to import it on a developer sandbox. However, it isn't desirable to import all of the site's data, either because of the size of the site or because of privacy concerns around customer data. In this case you can use the export feature to export only the site-specific data you want and import it into your sandbox. |

*Granularity:* selected sites.

Other information you must know about Site Import/Export:

-   The Site Import/Export function in the Business Manager uses standard Business Manager imports/exports for some of its object types; so some XML files use the same schema within Site Export .zip files.
-   Site Export also supports some object types excluded from the standard import/export functionality (for example, schedules and site preferences).
-   It isn't possible to trigger a Site Import programmatically.
-   A catalog and a site can be exported without the static content being included in the resulting archive file. This behavior allows users more granular control over the export process. This behavior is also important because the size of the archive files rapidly exceeds the WebDAV file size limitation when images are included.
-   Compatibility of the import/export format is ensured for the same B2C Commerce version only.
-   The list of custom cartridges used for Business Manager is supported in the site import/export. The file preferences.xml, which contains global preferences, includes the additional preference identified by the key "CustomCartridges".
-   The site export function in Business Manager lets you export a catalog and a site without the static content being included in the resulting archive file. This change provides more granular control over the export process. This change is also important because the size of the archive files rapidly exceeds the WebDAV file size limitation when images are included.

## Business Manager Import Location

**Administration** | **Site Development** | **Site Import & Export**.

## Initial Instance Setup

You can configure:

-   Initial organization data (site independent) such as:
    -   Global preferences, such as locales and instance time zones
    -   Global custom objects
    -   Schedules
    -   System object attribute extensions
    -   Custom object types
    -   Custom preference type definitions
-   Catalogs, price books, and inventory lists
-   Site-specific data including business objects, such as:
    -   Custom objects
    -   Content library, assets, and images
    -   Customers and customer groups
    -   Shipping, tax and payment configuration
    -   Stores
    -   Site preferences
    -   Search configuration
    -   Source Codes
    -   Catalog price book and inventory list site assignments

## Archiving Data of an Instance

Use Site export to export instance data that consists of all sites and corresponding business objects and global data (except carts, wish lists, and orders).

## Pipelets

N/A

## Site Export File Consistency in B2C Commerce

The Catalog, Customers, Inventory, and Access Roles site export files are created consistently, exported in sorted order. This behavior ensures that a diff of XML feeds is guaranteed to reveal data changes and differences. Developers work in a collaborative environment, working with and changing a common site import definition. Thus, exports provide the only way to compare the content of two instances. This topic applies to B2C Commerce.

-   The customer file is sorted by address ID in ascending alphabetical order
-   The access roles file is sorted in ascending alphabetical order based on the *resource path* of an access control element. If the resource paths of two access control elements are the same, it then sorts by the permission.
-   The Inventory file is sorted in ascending alphabetical order based on product ID.
-   The catalog file is sorted by the following rules (in the following order):

| Element | Sort order |
| --- | --- |
| Categories | Depth-first recursive ordering. Sibling categories are ordered by position. Unsorted categories appear at end of list ordered by name. Example: Root, JA, JB, JC, K, KA, KB, |
| Category refinement definitions | Sorted by position |
| Category refinement bucket definitions | Sorted by position |
| Category product attribute groups | Sorted by position |
| Category product attributes | Sorted by position |
| Category links | Sorted by position |
| Products | Sorted by SKU |
| Product bundled products | Sorted by position |
| Product retail set products | Sorted by position |
| Product product set products | Sorted by position |
| Product options | Sorted by position |
| Product links | Sorted by position |
| Product variation attributes | Sorted by position |
| Product variations | Sorted by position |
| Shared product options | Sorted by ID |
| Shared product option values | Sorted by position |
| Shared variation attributes | Sorted by ID |
| Shared variation attribute values | Sorted by position |
| Category assignments | Ordered by category name, then position (unsorted products at end), then product SKU |
| Recommendations | Ordered by sourcetype, sourceid, targettype, typecode, position |
| For all business objects: Custom attributes | Sorted alphabetically by ID across all attribute groups |

## Site Export Archive Structure

Description of the structure on which the .zip file is based. During an export process, this directory structure is created within the archive. If a selective export with a subset of data is started, a fragmented structure according to the data units selected is created. A site import parses the archive and expects the exact same structure. This topic applies to B2C Commerce.

### Preferences.xml

Organization-specific preferences.

### Schedules.xml

All schedules.

### Meta/

| First level | Second level | Third level | Description |
| --- | --- | --- | --- |
| system-objecttype-extensions.xml |  |  |  |
| custom-objecttype-extensions.xml |  |  |  |
| custom-objecttype-extensions.xml |  |  |  |

### Custom-Objects/

Import processes all import files in this directory; Export generates a file per object type.

### Catalogs/

Root directory for all catalog data files.

| First level | Second level | Third level | Description |
| --- | --- | --- | --- |
| my_catalog_1/ |  |  | Root directory for all data related to a specific catalog. Export uses the catalog ID as the directory name. Import processes any subdirectory of catalogs/. |
|  | catalog.xml |  | Data file for the catalog. Export uses the catalog ID as the file name. Import can handle any file name (catalog ID is specified in the file). |
| my_catalog_2/ |  |  |  |
|  | catalog.xml |  |  |
|  | static/ |  |  |

### Inventory-Lists/

Root directory for all inventory lists.

| First Level | Second Level | Third Level | Description |
| --- | --- | --- | --- |
| inventory_list_A.xml |  |  |  |
| inventory_list_B.xml |  |  |  |

### Price Books/

| First Level | Second Level | Third Level | Description |
| --- | --- | --- | --- |
| my_pricebook_1.xml |  |  |  |
| my_pricebook_2.xml |  |  |  |

### Static/

Directory contains all organization static files

### Sites/

All site directories

| First Level | Second Level | Third Level | Description |
| --- | --- | --- | --- |
| my_site_1/ |  |  |  |
|  | site.xml |  | Site definition |
|  | preferences.xml |  | Site settings |
|  | tax.xml |  | Site tax table |
|  | shipping.xml |  | Site shopping methods and costs |
|  | custom-objects/ |  | Import processes all import files in this directory. Export generates a file per object type. |
|  | library/ |  | Content library of the site |
|  |  | library.xml |  |
|  |  | static/ |  |
|  | customers.xml |  | All site customers |
|  | customer-groups.xml |  | All site customer groups |
|  | source-codes.xml |  | Source-code definitions for the site |
|  | search.xml |  | Search settings: synonyms, stopwords, |
|  | payment-processors.xml |  | Configuration of standard payment processors as well as definition of custom payment processors. |
|  | stores.xml |  | All stores of the site |
| my_site_2/ |  |  | The structure is similar for all additional sites. |

## Use Site Import/Export to Import Reference Application Demo Sites in B2C Commerce

You can import Commerce Cloud reference application demo sites into a sandbox. Demo sites are prebuilt and enable you to explore storefront functionality. Unlike custom sites, demo sites don’t have to be exported from other instances. They can be immediately imported into sandboxes. This topic applies to B2C Commerce.

There are two demo sites:

-   Storefront Reference Architecture (SFRA) Demo Sites: When you import an SFRA demo site, Business Manager shows a list of available demo configurations. Each demo configuration is a combination of site data and feature code that you can import into the sandbox. To select the demo configuration that you want, read the descriptions provided in the list. When you import a demo configuration, several actions are performed:
    -   The configuration's site data is imported into your sandbox.
    -   The configuration’s cartridges and code are uploaded into a unique code version directory.
    -   The code version directory is automatically activated. (Each configuration has its own unique code version directory.)
    -   Search indexes are automatically updated.
-   SiteGenesis (SGJC) Demo Site: When you import the SGJC demo site, Business Manager imports the site data only. You upload code separately. Search indexes aren’t automatically updated.

![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/beac8152-03cc-40b1-b594-e8ed108b8b62/images/icon_note.png)

Note When you import a demo site, you import data (and code) that can be older than the data and code in the associated git repositories.

### Import the Storefront Reference Architecture (SFRA) Demo Site

You can import the SFRA demo site using Business Manager.

### Required Editions

| Available in: B2C Commerce |
| --- |

1.  Log in to Business Manager with an account that has import/export privileges for the site. Administrators can check account privileges by selecting **Administration** | **Organization** | **Roles and Permissions.**
2.  Select **Administration** | **Site Development** | **Site Import** | **Export.**
3.  Select Storefront Reference Architecture Demo Sites.
4.  Click **Import**.
5.  Select a demo configuration and click **Deploy**.
6.  To see the progress of the import process, click **Refresh** in the Status section.

### Import the SiteGenesis JavaScript Controllers (SGJC) Demo Site

You can import the SGJC demo site using Business Manager.

### Required Editions

| Available in: B2C Commerce |
| --- |

1.  Log in to Business Manager with an account that has import/export privileges for the site. Administrators can check account privileges by selecting **Administration** | **Organization** | **Roles and Permissions.**
2.  Select **Administration > Site Development > Site Import & Export.**
3.  Select SiteGenesis Demo Site.
4.  Click **Import**. A message asks you to confirm that you want to import the demo site.
5.  To confirm, click **OK**.
6.  To see the progress of the import process, click **Refresh** in the Status section.
