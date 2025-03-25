import React, { useState, useEffect } from 'react';


const MemoryList: React.FC = () => {
    interface Memory {
        payload: {
            speaker: string;
            document: string;
        };
    }

    const [memories, setMemories] = useState<Memory[]>([]);
    const [loading, setLoading] = useState(true);
    const [limit] = useState(50);
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const fetchMemories = async () => {
            setLoading(true);
            const mem_response = await fetch('/api/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    })
            });
            const data = await mem_response.json();
            console.log("memory retrieved: " + JSON.stringify(data))
            setMemories(data[0]);
            // console.log(data[0])
            setLoading(false);
        };

        fetchMemories();
    }, [limit, offset]);

    const handleNextPage = () => {
        setOffset(prevOffset => prevOffset + limit);
    };

    const handlePreviousPage = () => {
        setOffset(prevOffset => Math.max(prevOffset - limit, 0));
    };

    return (
        <div>
            {loading && <p>Loading...</p>}
            <ul>
                {memories && memories.map((memory, index) => (
                    <li key={index}>
                        {memory.payload.document}
                    </li>
                ))}
            </ul>
            <button onClick={handlePreviousPage} disabled={offset === 0}>Previous</button>
            <button onClick={handleNextPage}>Next</button>
        </div>
    );
};

export default MemoryList;