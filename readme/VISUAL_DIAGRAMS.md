# Visual Diagrams - Bulk Dealer Creation Feature

## 1. UI Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│          SuperAdminDashboard - Dealers Tab                 │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼────┐            ┌─────▼─────┐
    │  Single │            │   Bulk    │
    │ Create  │            │  Create   │
    └─────────┘            └─────┬─────┘
                                 │
                   ┌─────────────┴──────────────┐
                   │                           │
            ┌──────▼──────┐            ┌───────▼──────┐
            │  Text Input │            │ Excel Upload │
            └──────┬──────┘            └───────┬──────┘
                   │                          │
        ┌──────────┴──────────┐    ┌─────────┴─────────┐
        │                     │    │                   │
   ┌────▼─────┐       ┌──────▼──┐ ┌──▼─────────┐ ┌───▼──────┐
   │ Textarea │       │ Generate│ │  File      │ │Auto-Parse│
   │  Input   │       │  IDs &  │ │  Input     │ │  on Load │
   │          │       │ Preview │ │            │ │          │
   └────┬─────┘       └──────┬──┘ └──┬─────────┘ └───┬──────┘
        │                    │        │              │
        └────────────────────┴────────┴──────────────┘
                             │
                    ┌────────▼────────┐
                    │  Data Parsing   │
                    │ & ID Generation │
                    └────────┬────────┘
                             │
                    ┌────────▼─────────────┐
                    │   Preview Table     │
                    │ (Email, UserId,     │
                    │  Name, District)    │
                    └────────┬────────────┘
                             │
               ┌─────────────┴────────────┐
               │                         │
          ┌────▼──────┐            ┌─────▼─────┐
          │   Clear   │            │  Create X │
          │   Data    │            │  Dealers  │
          └───────────┘            └─────┬─────┘
                                        │
                            ┌───────────▼───────────┐
                            │  Validation Check     │
                            │  (Email + Password)   │
                            └───────────┬───────────┘
                                        │
                            ┌───────────▼───────────┐
                            │   POST to API         │
                            │  /dealers/bulk        │
                            └───────────┬───────────┘
                                        │
                    ┌───────────────────┴──────────────────┐
                    │                                      │
            ┌───────▼──────┐                      ┌────────▼────────┐
            │  Success     │                      │     Failure     │
            │  - Created   │                      │  - Error Alert  │
            │  - Count     │                      │  - Failed List  │
            │  - Refresh   │                      │  - Retry Option │
            └──────────────┘                      └─────────────────┘
```

---

## 2. Data Structure Transformation

```
┌─────────────────────────────────────────────────────────────┐
│                   INPUT SOURCES                              │
├──────────────────────┬───────────────────────────────────────┤
│     Text Input       │         Excel File                    │
├──────────────────────┼───────────────────────────────────────┤
│ email,password,UserId│ 📊 Spreadsheet with columns:         │
│ ,name,District,      │    email, password, UserId, ...      │
│ Branch,Contact       │                                       │
│                      │                                       │
│ dealer@mail.com,pass │ [Excel Parser - XLSX Library]       │
│ ,USER001,John,Mumbai │                                       │
│ ,Central,9876543210  │ Recognized Headers (Case-insensitive)│
│                      │ email/Email/EMAIL                    │
│                      │ password/Password/PASSWORD           │
│                      │ UserId/userid/Userid                 │
└──────────────────────┴───────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │  Parsing Layer     │
                    │                    │
                    │ Text:              │
                    │ split('\n')        │
                    │ split(',')         │
                    │                    │
                    │ Excel:             │
                    │ XLSX.read()        │
                    │ sheet_to_json()    │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │  Normalization     │
                    │                    │
                    │ email             │
                    │ password          │
                    │ UserId (or auto)  │
                    │ name              │
                    │ District          │
                    │ Branch            │
                    │ Contact           │
                    └────────┬───────────┘
                             │
                             ▼
          ┌──────────────────────────────────┐
          │   ID Generation (if needed)      │
          │                                  │
          │   If UserId empty:               │
          │   generateUserId()               │
          │                                  │
          │   USER001000 → USER001001 → ... │
          └──────────────┬───────────────────┘
                         │
                         ▼
          ┌──────────────────────────────────┐
          │   Dealer Object Array            │
          │   [                              │
          │     {                            │
          │       email: "...",              │
          │       password: "...",           │
          │       UserId: "USER001000",      │
          │       name: "...",               │
          │       District: "...",           │
          │       Branch: "...",             │
          │       Contact: "..."             │
          │     },                           │
          │     { ... more dealers ... }    │
          │   ]                              │
          └──────────────────────────────────┘
```

---

## 3. ID Generation Logic

```
                    ┌─────────────────────┐
                    │   Start Processing  │
                    │   nextUserId = 1000 │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  For Each Row:      │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                            │
           ┌────▼──────────┐      ┌─────────▼─────┐
           │ UserId Exists?│      │ Empty/Missing?│
           │ & Not Empty?  │      │               │
           └────┬──────────┘      └─────────┬─────┘
                │ YES                       │ NO
                │                          │
           ┌────▼──────────┐      ┌────────▼──────┐
           │ Use Provided  │      │ generateUserId│
           │ UserId        │      │()             │
           │               │      │               │
           │ Example:      │      │ String =      │
           │ CUSTOM_ID_1   │      │ 'USER' +      │
           │               │      │ padStart(6,0) │
           │               │      │               │
           │               │      │ nextUserId++  │
           └───┬────────┬──┘      └────┬──────┬───┘
               │        │             │      │
               └────────┼─────────────┴──────┘
                        │
                        │
         ┌──────────────▼──────────────┐
         │   Result for this record:   │
         │   {                         │
         │     UserId: "USER001000"    │
         │   }                         │
         └──────────────┬──────────────┘
                        │
                ┌───────▼─────────┐
                │ Next Record?    │
                └───────┬─────────┘
                        │
         ┌──────────────┴──────────────┐
         │ YES - Loop back             │
         │ NO - Done                   │
         │      nextUserId = 1001      │
         │      Return all records     │
         └─────────────────────────────┘
```

---

## 4. Preview Table Structure

```
┌──────────────────────────────────────────────────────────────┐
│               PREVIEW TABLE (Scrollable)                     │
├────┬──────────────────┬─────────────┬──────────┬─────────────┤
│ #  │ Email            │ UserId      │ Name     │ District    │
├────┼──────────────────┼─────────────┼──────────┼─────────────┤
│ 1  │ dealer1@mail.com │ USER001000  │ John     │ Mumbai      │
├────┼──────────────────┼─────────────┼──────────┼─────────────┤
│ 2  │ dealer2@mail.com │ USER001001  │ Sarah    │ Delhi       │
├────┼──────────────────┼─────────────┼──────────┼─────────────┤
│ 3  │ dealer3@mail.com │ CUSTOM_ID   │ Mike     │ Bangalore   │
├────┼──────────────────┼─────────────┼──────────┼─────────────┤
│ 4  │ dealer4@mail.com │ USER001002  │ Emma     │ Pune        │
├────┼──────────────────┼─────────────┼──────────┼─────────────┤
│... │ ...              │ ...         │ ...      │ ...         │
└────┴──────────────────┴─────────────┴──────────┴─────────────┘

Max Height: 300px (scrollable)
Display: Email, UserId, Name, District only
Action Buttons: "Create 4 Dealers" | "Clear"
```

---

## 5. API Integration Flow

```
        Frontend
        ┌─────────────────────────────────────┐
        │   bulkCreateDealers()               │
        │                                     │
        │   1. Validate records               │
        │   2. Build dealers array            │
        │   3. POST /dealers/bulk             │
        │      { dealers: [...] }             │
        └──────────────┬──────────────────────┘
                       │
                       │ HTTP POST
                       │
                       ▼
        Backend
        ┌─────────────────────────────────────┐
        │   POST /superadmin/dealers/bulk     │
        │                                     │
        │   1. Validate input                 │
        │   2. Create dealers                 │
        │   3. Check for errors               │
        │   4. Return results                 │
        └──────────────┬──────────────────────┘
                       │
                       │ Response
                       │ {
                       │   results: {
                       │     success: [
                       │       {email, userId, ...}
                       │     ],
                       │     failed: [
                       │       {email, error, ...}
                       │     ]
                       │   }
                       │ }
                       ▼
        Frontend
        ┌─────────────────────────────────────┐
        │   Handle Response                   │
        │                                     │
        │   1. Clear form                     │
        │   2. Fetch dealers list             │
        │   3. Show alert with results        │
        │   4. Display failed details         │
        └─────────────────────────────────────┘
```

---

## 6. State Update Sequence

```
Initial State:
┌─────────────────────────┐
│ bulkDealersText = ""    │
│ bulkDealersData = []    │
│ nextUserId = 1000       │
│ bulkUploadMode = "text" │
└─────────────────────────┘
                ↓
User enters text or uploads file
                ↓
Generated/handleExcel called
                ↓
┌─────────────────────────────────┐
│ bulkDealersData = [             │
│   {email, password, UserId...}  │
│   {email, password, UserId...}  │
│ ]                               │
│ nextUserId = 1002 (incremented) │
└─────────────────────────────────┘
                ↓
User clicks "Create Dealers"
                ↓
bulkCreateDealers() called
                ↓
┌─────────────────────────┐
│ API POST submitted      │
│ setBusy(true)           │
└─────────────────────────┘
                ↓
API response received
                ↓
┌─────────────────────────┐
│ bulkDealersText = ""    │
│ bulkDealersData = []    │
│ nextUserId = 1000       │ ← Reset to 1000
│ setBusy(false)          │
│ fetchDealers()          │ ← Refresh list
└─────────────────────────┘
                ↓
Success/Error Alert shown
```

---

## 7. File Format Comparison

```
TEXT INPUT FORMAT:
┌─────────────────────────────────────┐
│ email,password,UserId,name,...      │
│ dealer1@mail.com,pass123,,John,...  │
│ dealer2@mail.com,pass456,,Sarah,... │
└─────────────────────────────────────┘

EXCEL FORMAT:
┌────────────┬──────────┬────────┬──────┐
│ email      │ password │ UserId │ name │
├────────────┼──────────┼────────┼──────┤
│ dealer1@.. │ pass123  │        │ John │
├────────────┼──────────┼────────┼──────┤
│ dealer2@.. │ pass456  │ CUST_1 │ Sarah│
└────────────┴──────────┴────────┴──────┘

CSV FORMAT:
┌─────────────────────────────────────┐
│ Same as TEXT INPUT (comma-separated)│
│ Can be opened in Excel              │
│ .csv file extension                 │
└─────────────────────────────────────┘
```

---

## 8. Error Handling Flow

```
            Input Received
                    ↓
        ┌───────────┴────────────┐
        │                        │
    ┌───▼──┐              ┌──────▼──┐
    │Parse │              │Validate │
    │Error │              │ Error   │
    └───┬──┘              └──────┬──┘
        │                        │
    ┌───▼──────────┐    ┌───────▼─────────┐
    │ Show Error   │    │ Validation      │
    │ message with │    │ • Email exists  │
    │ line number  │    │ • Empty field   │
    │              │    │ • Bad format    │
    │ Example:     │    │ • Duplicate     │
    │ "Line 3:     │    │                 │
    │  Email and   │    │ Show detailed   │
    │  password    │    │ error for each  │
    │  required"   │    │ failed record   │
    └──────────────┘    └─────────────────┘
```

---

## 9. Mode Selection Diagram

```
         BULK CREATE MODE
                ↓
        ┌───────┴───────┐
        │               │
    ┌───▼────┐    ┌─────▼──────┐
    │ Single │    │   Bulk     │
    │ Create │    │   Create   │
    └────────┘    └─────┬──────┘
                        │
                ┌───────┴──────────┐
                │                  │
          ┌─────▼──────┐    ┌──────▼─────┐
          │ Text Mode  │    │ Excel Mode │
          │            │    │            │
          │ Textarea   │    │ File Input │
          │ CSV format │    │ .xlsx/.xls │
          │            │    │            │
          │ Button:    │    │ Auto-parse │
          │ Generate & │    │ on select  │
          │ Preview    │    │            │
          └────────────┘    └────────────┘
```

---

## 10. Key Statistics

```
AUTO-ID GENERATION:
┌────────────┬─────────────────┐
│ Dealer #   │ Generated ID    │
├────────────┼─────────────────┤
│ 1st        │ USER001000      │
│ 2nd        │ USER001001      │
│ 10th       │ USER001009      │
│ 100th      │ USER001099      │
│ 1000th     │ USER001999      │
│ 10000th    │ USER010999      │
└────────────┴─────────────────┘

FIELD REQUIREMENTS:
┌──────────┬──────────┬─────────────────┐
│ Field    │ Required │ Auto-Generated  │
├──────────┼──────────┼─────────────────┤
│ email    │ ✅ Yes   │ ❌ No           │
│ password │ ✅ Yes   │ ❌ No           │
│ UserId   │ ❌ No    │ ✅ Yes (if empty)│
│ name     │ ❌ No    │ ❌ No           │
│ District │ ❌ No    │ ❌ No           │
│ Branch   │ ❌ No    │ ❌ No           │
│ Contact  │ ❌ No    │ ❌ No           │
└──────────┴──────────┴─────────────────┘
```

---
