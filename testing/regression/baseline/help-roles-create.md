# Create a Role in B2C Commerce

A role is a named group of permissions. For example, you can group all of the permissions related to catalog management into a role called Catalog Manager. You can then assign this role to the user whose job it is to manage the catalog. This topic applies to B2C Commerce.

### Required Editions

| Available in: B2C Commerce |
| --- |

The SiteGenesis application contains several roles predefined for your convenience, such as the Administrator role. You can import and export these roles. Use the roles without modification or customize them to suit your application needs. If necessary, you can remove the roles and create your own set of roles. Make sure you grant at least one user with access to the Roles and Permissions module.

To manage roles and permissions, you must have permissions to the Roles & Permissions module. To add a user and to manage user login and credential information, you must have permissions to the Users module. To assign or unassign roles to users, you must have permissions to both the Users module and the Roles & Permissions module.

If you don't have a user with access to the Roles and Permissions module, contact Commerce Cloud Support to reinstate access to this module.

![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/beac8152-03cc-40b1-b594-e8ed108b8b62/images/icon_note.png)

Note A list of assigned roles also appears on the Roles page of a user definition.

1.  Select **Administration** | **Organization** | **Roles & Permissions**.

    Roles marked with a yellow triangle are security-sensitive. They have permission to manage users or access roles or both. Use care when changing these roles so you don't give access privileges to the wrong users.

2.  Click **New**.
3.  On the General tab, define or edit general information and click **Apply.**

    A role's ID is limited to:

    -   letters (including non-Latin)
    -   numbers
    -   whitespace
    -   special characters: `_ ! " & \ ' ( ) + - . , / : < > ? @ [ ]`

    IDs with not-allowed characters are rejected and the access role can't be created or imported.

4.  On the Users tab, select users and click **Assign**.

    To use the Users tab to assign users to a role, you must also have permissions to the Users module.

## Assign Business Manager Module Permissions

Assign each role access to Business Manager Modules.

### Required Editions

| Available in: B2C Commerce |
| --- |

1.  Select **Administration** | **Organization** | **Roles & Permissions**
2.  Select a role.
3.  On the **Business Manager Module** tab, select the context in which you want to assign permissions.

    Click **Select Context** if context has already been specified and you want to change it. To revert from individual sites to `Organization`, uncheck **All Sites** before checking **Organization**.

4.  Click **Apply**.
5.  Select **Read** or **Write** per module to enable or disable permissions.

    If a user has read-only permission, they can see the respective module, but can't create, edit, or configure settings in that module. This also applies to access via B2C Commerce API calls.

6.  Click **Update.**

## Assign Functional Permissions

Functional permissions let a role perform an action.

### Required Editions

| Available in: B2C Commerce |
| --- |

1.  Select **Administration** | **Organization** | **Roles & Permissions**.
2.  Select a role.
3.  On the Functional Permissions select the context in which you want to assign permissions.

    Click **Select Context** if context has already been specified and you want to change it. To revert from individual sites to Organization, uncheck **All Sites** before checking **Organization**.

4.  Assign functional permissions to your role.

    All sites are listed. Any user can select a site without having permission. However, if a user doesn't have access to the Business Manager modules within that site, they only see an empty navigation bar.

5.  Click **Update**.

    All permissions are cumulative.

## Assign WebDAV Permissions

When selecting a WebDAV permission ending with an asterisk ('/catalogs/\*', '/libraries/\*' or '/dynamic/\*') or '(all other folders)', the permission is granted for all future subfolders automatically. To prevent this behavior check the sub-permissions manually.

### Required Editions

| Available in: B2C Commerce |
| --- |

1.  Select **Administration** | **Organization** | **Roles & Permissions**.
2.  Select a role.
3.  On the WebDAV Permissions tab, grant read or write access to specific folders.

    See [WebDAV Permissions](https://help.salesforce.com/s/articleView?id=cc.b2c_administrator_role.htm&language=en_US&type=5#b2c_using_web_dav_permissions "To grant access to specific WebDAV folders, use WebDAV permissions. WebDAV permissions apply to your entire organization.").

4.  Click **Update**.

## Assign Locale Permissions

Assign permissions on individual locales to a role. A user with no permission on a locale can't view or edit localized attributes in that locale.

### Required Editions

| Available in: B2C Commerce |
| --- |

1.  Select **Administration** | **Organization** | **Roles & Permissions**.
2.  Select a role.
3.  On the Locale Permissions page, click a locale link, for example, **de**.
4.  Grant read or write access to specific locales (using the checkboxes) and click **Update**.
5.  On the Local - General tab, you can view general read-only information about the locale.
6.  Configure the Fallback Locale.

    For example, you can set it to Default or disable it.

7.  On the **Regional Settings** tab, specify number and currency settings.
8.  Click **Apply** to save your settings.

## Assign a Price Adjustment Limit

You can assign limits per user for manual price adjustments in Business Manager. You can select a context of one, multiple, or all sites for which the limits apply.

### Required Editions

| Available in: B2C Commerce |
| --- |

You can access limits programmatically via the Script API, `dw.order.LineItemCtnr.verifyPriceAdjustmentLimits()`.

A price adjustment limits violation check is done during manual price adjustment creation by OCAPI, as follows:

```
POST /baskets/\{basket_id\}/price_adjustments
```

Price adjustment limits are imported and exported through the site import/export.

1.  Select **Administration > Organization > Roles and Permissions** > and select Administrator.
2.  On the **Price Adjustment Limits** tab, select the context in which you want to assign permissions.
3.  Click **Apply**.
4.  To add a limit, click **Add**.
5.  On the Add Price Adjustment Limit window, select a type (Item, Shipping, or Order), a currency, and a value.

    Price adjustment limits validation considers only the access roles with price adjustment [permissions](https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/b2c-setting-permissions-for-csc.html) configured. Only price adjustment limits that are assigned to an access role with a specific type of price adjustment permission are considered when a manual price adjustment is validated. The type of price adjustment permission, item, order, or shipping, depends on the type of the manual price adjustment. To prevent all users with access to a role from creating unlimited manual item price adjustments, define price adjustment limits to access roles with an item, order, or shipping price adjustment permission.

6.  To change the context, click **Select Context**.

    When you change context from one to multiple sites, for example, you can see unassigned limits.

7.  To assign a limit, select the limit by checking the box and click **Update**.
8.  To unassign a limit, deselect the limit by unchecking box and click **Update**.
9.  To revert changes, click **Revert** before you click **Update**.

    When you click **Update**, your changes can't be reverted.
