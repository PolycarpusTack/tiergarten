import React, { useState, useEffect } from 'react';

const JiraConfigTest = () => {
    const [config, setConfig] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            console.log('Fetching JIRA config test...');
            const response = await fetch('/api/test/jira-config');
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Config data:', data);
            setConfig(data);
        } catch (err) {
            console.error('Error fetching config:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!config) return <div>No config data</div>;

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f0f0', margin: '20px' }}>
            <h3>JIRA Configuration Test</h3>
            <pre>{JSON.stringify(config, null, 2)}</pre>
            <button onClick={fetchConfig}>Refresh</button>
        </div>
    );
};

export default JiraConfigTest;