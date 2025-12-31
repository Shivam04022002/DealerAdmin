import XLSX from 'xlsx';

// This is a helper script to create a sample Excel template
// Run this to generate: dealer_bulk_template.xlsx

const createBulkDealerTemplate = () => {
  const data = [
    {
      email: 'dealer1@example.com',
      password: 'SecurePass123!',
      UserId: 'USER001000', // Leave empty or omit to auto-generate
      name: 'Dealer One',
      District: 'Mumbai',
      Branch: 'Central',
      Contact: '9876543210'
    },
    {
      email: 'dealer2@example.com',
      password: 'SecurePass456!',
      UserId: 'USER001001',
      name: 'Dealer Two',
      District: 'Delhi',
      Branch: 'North',
      Contact: '8765432109'
    },
    {
      email: 'dealer3@example.com',
      password: 'SecurePass789!',
      UserId: '', // Auto-generated: USER001002
      name: 'Dealer Three',
      District: 'Bangalore',
      Branch: 'South',
      Contact: '7654321098'
    }
  ];

  // Create workbook and worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dealers");

  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, // email
    { wch: 20 }, // password
    { wch: 15 }, // UserId
    { wch: 20 }, // name
    { wch: 18 }, // District
    { wch: 15 }, // Branch
    { wch: 15 }  // Contact
  ];

  // Write file
  XLSX.writeFile(wb, 'dealer_bulk_template.xlsx');
};

// Call this function to generate the template
createBulkDealerTemplate();
