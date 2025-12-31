# Sample Data for Testing

## Text Input Samples

### Sample 1: Minimal (Auto-Generate IDs)
```
dealer1@mail.com,password123,,,,
dealer2@mail.com,password456,,,,
dealer3@mail.com,password789,,,,
```

### Sample 2: With Names
```
dealer1@mail.com,pass123,,Dealer One,Mumbai,Central,9876543210
dealer2@mail.com,pass456,,Dealer Two,Delhi,North,8765432109
dealer3@mail.com,pass789,,Dealer Three,Bangalore,South,7654321098
```

### Sample 3: Complete with Custom IDs
```
dealer1@mail.com,pass123,DEALER001,John Smith,Mumbai,Central Branch,9876543210
dealer2@mail.com,pass456,DEALER002,Sarah Johnson,Delhi,North Branch,8765432109
dealer3@mail.com,pass789,DEALER003,Mike Brown,Bangalore,South Branch,7654321098
dealer4@mail.com,pass000,DEALER004,Emma Wilson,Pune,East Branch,6543210987
dealer5@mail.com,pass111,DEALER005,Alex Kumar,Hyderabad,West Branch,5432109876
```

### Sample 4: Mixed (Some auto, some custom)
```
dealer1@mail.com,pass123,,Auto ID Dealer,Mumbai,Branch1,9876543210
dealer2@mail.com,pass456,CUSTOM_ID_1,Custom ID Dealer,Delhi,Branch2,8765432109
dealer3@mail.com,pass789,,Another Auto,Bangalore,Branch3,7654321098
```

### Sample 5: Large Batch (50 dealers)
```
dealer01@example.com,pass001,,Dealer 01,Mumbai,Branch A,9001000000
dealer02@example.com,pass002,,Dealer 02,Mumbai,Branch B,9001000001
dealer03@example.com,pass003,,Dealer 03,Delhi,Branch C,9001000002
dealer04@example.com,pass004,,Dealer 04,Delhi,Branch D,9001000003
dealer05@example.com,pass005,,Dealer 05,Bangalore,Branch E,9001000004
dealer06@example.com,pass006,,Dealer 06,Bangalore,Branch F,9001000005
dealer07@example.com,pass007,,Dealer 07,Pune,Branch G,9001000006
dealer08@example.com,pass008,,Dealer 08,Pune,Branch H,9001000007
dealer09@example.com,pass009,,Dealer 09,Hyderabad,Branch I,9001000008
dealer10@example.com,pass010,,Dealer 10,Hyderabad,Branch J,9001000009
dealer11@example.com,pass011,,Dealer 11,Chennai,Branch K,9001000010
dealer12@example.com,pass012,,Dealer 12,Chennai,Branch L,9001000011
dealer13@example.com,pass013,,Dealer 13,Kolkata,Branch M,9001000012
dealer14@example.com,pass014,,Dealer 14,Kolkata,Branch N,9001000013
dealer15@example.com,pass015,,Dealer 15,Jaipur,Branch O,9001000014
dealer16@example.com,pass016,,Dealer 16,Jaipur,Branch P,9001000015
dealer17@example.com,pass017,,Dealer 17,Ahmedabad,Branch Q,9001000016
dealer18@example.com,pass018,,Dealer 18,Ahmedabad,Branch R,9001000017
dealer19@example.com,pass019,,Dealer 19,Surat,Branch S,9001000018
dealer20@example.com,pass020,,Dealer 20,Surat,Branch T,9001000019
```

---

## Excel File Structure

### Column Headers (Required)
```
email | password | UserId | name | District | Branch | Contact
```

### Sample Row
```
dealer1@example.com | SecurePass123 | USER001000 | Dealer Name | Mumbai | Central | 9876543210
```

### Variant Headers (All Recognized)
```
Email | Password | userid | Name | DISTRICT | branch | phone
dealer@example.com | pass123 | | Dealer A | Mumbai | Branch 1 | 9876543210
```

---

## Instructions for Creating Excel File

1. **Open** Excel or Google Sheets
2. **Create** these column headers in Row 1:
   - A1: email
   - B1: password
   - C1: UserId
   - D1: name
   - E1: District
   - F1: Branch
   - G1: Contact

3. **Enter** data starting from Row 2:
   ```
   Row 2: dealer1@mail.com | pass123 | | Dealer One | Mumbai | Central | 9876543210
   Row 3: dealer2@mail.com | pass456 | | Dealer Two | Delhi | North | 8765432109
   ```

4. **Save** as .xlsx or .xls

5. **Upload** in SuperAdmin Dashboard

---

## Testing Scenarios

### Test 1: Basic Auto-ID
- Enter 3-5 dealers without UserId
- Verify IDs auto-generate as USER001000, USER001001...
- Expected: All dealers created successfully

### Test 2: Mixed IDs
- Enter 3 dealers: first auto, second custom, third auto
- Expected: First and third get USER001000 and USER001001, second gets custom ID

### Test 3: Excel Upload
- Create Excel with 10 dealers
- Leave UserId column empty for all
- Upload and verify auto-generation
- Expected: All created with sequential IDs

### Test 4: Error Handling
- Enter dealer without email
- Try to create
- Expected: Error message pointing to record number

### Test 5: Batch Size
- Test with 50, 100, 200 dealers
- Expected: System handles large batches smoothly

---

## Data Validation Checks

✅ Email validation
✅ Password required
✅ No blank lines
✅ Proper CSV format
✅ Valid Excel structure

---

## Common Issues & Solutions

**Issue: "Email and password required"**
- Solution: Check row has both email and password

**Issue: UserId not generating**
- Solution: Leave UserId column completely empty (not with spaces)

**Issue: Excel won't upload**
- Solution: Use .xlsx or .xls format, not .csv as .xlsx

**Issue: Duplicate email error**
- Solution: Check all emails are unique in batch and database

---
