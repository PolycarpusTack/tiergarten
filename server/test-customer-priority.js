const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testCustomerPriority() {
    console.log('Testing Customer Priority field mapping...\n');
    
    try {
        // 1. Check JIRA configuration
        console.log('1. Checking JIRA configuration...');
        const configResponse = await axios.get(`${BASE_URL}/api/jira/credentials-status`);
        console.log('   JIRA Configured:', configResponse.data.isConfigured);
        console.log('   JIRA URL:', configResponse.data.jiraBaseUrl || 'Not configured');
        console.log('');
        
        if (!configResponse.data.isConfigured) {
            console.log('⚠️  JIRA is not configured. Please configure JIRA credentials first.');
            return;
        }
        
        // 2. Test field mappings
        console.log('2. Testing field mappings...');
        const debugResponse = await axios.get(`${BASE_URL}/api/jira/debug-fields`);
        
        if (debugResponse.data.fieldMapping) {
            console.log('   Field Mappings Found:');
            console.log('   - Customer Priority Field ID:', debugResponse.data.fieldMapping.customerPriority || 'NOT FOUND');
            console.log('   - MGX Priority Field ID:', debugResponse.data.fieldMapping.mgxPriority || 'NOT FOUND');
            console.log('');
            
            if (debugResponse.data.sampleTicket) {
                console.log('   Sample Ticket Data:');
                console.log('   - Key:', debugResponse.data.sampleTicket.key);
                console.log('   - Priority:', debugResponse.data.sampleTicket.priority);
                console.log('   - Customer Priority:', debugResponse.data.sampleTicket.customerPriority || 'NULL');
                console.log('   - MGX Priority:', debugResponse.data.sampleTicket.mgxPriority || 'NULL');
                console.log('');
            }
        }
        
        // 3. Check actual tickets
        console.log('3. Checking actual tickets for Customer Priority...');
        const ticketsResponse = await axios.get(`${BASE_URL}/api/tickets`);
        const allTickets = [...ticketsResponse.data.exceptions, ...ticketsResponse.data.regularTickets];
        
        console.log(`   Total tickets: ${allTickets.length}`);
        
        // Count tickets with customer priority
        const ticketsWithCustomerPriority = allTickets.filter(t => t.customerPriority);
        const ticketsWithMgxPriority = allTickets.filter(t => t.mgxPriority);
        
        console.log(`   Tickets with Customer Priority: ${ticketsWithCustomerPriority.length}`);
        console.log(`   Tickets with MGX Priority: ${ticketsWithMgxPriority.length}`);
        console.log('');
        
        // Show sample of tickets with priorities
        if (ticketsWithCustomerPriority.length > 0) {
            console.log('   Sample tickets with Customer Priority:');
            ticketsWithCustomerPriority.slice(0, 3).forEach(ticket => {
                console.log(`   - ${ticket.key}: Customer Priority = "${ticket.customerPriority}", MGX Priority = "${ticket.mgxPriority || 'N/A'}"`);
            });
        } else {
            console.log('   ⚠️  No tickets found with Customer Priority values');
        }
        
        // Summary
        console.log('\n4. Summary:');
        if (debugResponse.data.fieldMapping?.customerPriority) {
            console.log('   ✅ Customer Priority field is mapped (Field ID: ' + debugResponse.data.fieldMapping.customerPriority + ')');
        } else {
            console.log('   ❌ Customer Priority field mapping not found');
            console.log('   This could mean:');
            console.log('   - The field doesn\'t exist in your JIRA instance');
            console.log('   - The field has a different name (not matching "Customer Prio", "Customer Priority", etc.)');
            console.log('   - The field mapper needs to be updated with your specific field name');
        }
        
        if (ticketsWithCustomerPriority.length > 0) {
            console.log('   ✅ Customer Priority values are being pulled from JIRA');
        } else {
            console.log('   ⚠️  No Customer Priority values found in tickets');
            console.log('   This could mean:');
            console.log('   - The field exists but has no values set in JIRA');
            console.log('   - The field is not accessible with current permissions');
            console.log('   - The field extraction logic needs adjustment');
        }
        
    } catch (error) {
        console.error('Error testing Customer Priority:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testCustomerPriority();