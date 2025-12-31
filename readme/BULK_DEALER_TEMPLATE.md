# Bulk Dealer Creation Guide

## Overview
The SuperAdminDashboard now supports creating multiple dealers in two ways:
1. **Text Input Mode** - Paste CSV-formatted data
2. **Excel Upload Mode** - Upload an Excel/CSV file

## Text Input Format

Enter dealer data one per line with comma-separated values:

```
email,password,UserId,name,District,Branch,Contact
dealer1@example.com,password123,,John Dealer,Mumbai,Central,9876543210
dealer2@example.com,password456,,Sarah Dealer,Delhi,North,8765432109
```

**Fields:**
- `email` (required) - Dealer's email address
- `password` (required) - Dealer's login password
- `UserId` (optional) - If empty, will auto-generate (USER001000, USER001001, etc.)
- `name` - Dealer's name
- `District` - District name
- `Branch` - Branch name
- `Contact` - Phone number or contact info

**Example with auto-generated IDs:**
```
dealer1@example.com,pass123,,Dealer A,Mumbai,Branch1,9876543210
dealer2@example.com,pass456,,Dealer B,Delhi,Branch2,8765432109
```

## Excel File Format

Create an Excel file (.xlsx or .xls) with the following columns:

| email | password | UserId | name | District | Branch | Contact |
|-------|----------|--------|------|----------|--------|---------|
| dealer1@example.com | password123 | (leave empty) | John Dealer | Mumbai | Central | 9876543210 |
| dealer2@example.com | password456 | USER002 | Sarah Dealer | Delhi | North | 8765432109 |
| dealer3@example.com | password789 | (leave empty) | Mike Dealer | Bangalore | South | 7654321098 |

**Features:**
- Column names are case-insensitive (email, Email, EMAIL all work)
- If `UserId` is empty or missing, it will auto-generate
- All other fields are optional

## Auto-Generated UserId Format

When UserId is not provided, the system auto-generates:
- USER001000
- USER001001
- USER001002
- etc.

## Steps to Bulk Create Dealers

1. Go to **Dealers** tab
2. Click **Bulk Create** button
3. Choose input method:
   - **Text Input**: Paste CSV data, click "Generate IDs & Preview"
   - **Excel Upload**: Click file input, select .xlsx/.xls file
4. Review the preview table
5. Click "Create X Dealers" to submit
6. Check results for success/failure messages

## Validation

The system validates:
- ✅ Email is required for each record
- ✅ Password is required for each record
- ✅ No duplicate emails
- ✅ Proper email format

## Error Handling

If any record fails:
- Successful records are created
- Failed records are reported with error details
- No partial data is stored

## Tips

💡 **Leave UserId empty** to let the system auto-generate sequential IDs
📋 **Use Excel** for large batches (easier to format and verify)
🔄 **Preview before submitting** to catch any data issues
