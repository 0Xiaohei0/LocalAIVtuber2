import { useEffect, useState } from 'react';
import { Search, Calendar, Database, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import SessionDetail from './session-detail';

interface ChatSession {
    id: string;
    title: string;
    created_at: string;
    history: Array<{
        role: string;
        content: string;
    }>;
    indexed?: boolean;
    messageCount?: number;
    lastActivity?: string;
}

export default function SessionList() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [indexedFilter, setIndexedFilter] = useState("all");
    const [sortBy, setSortBy] = useState("newest");
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

    const createNewSession = async () => {
        try {
            const response = await fetch('/api/chat/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: `New Chat`
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to create session');
            }
            
            const session = await response.json();
            await fetchSessions();
            return session.id;
        } catch (err) {
            console.error('Failed to create session:', err);
            return null;
        }
    };

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/chat/sessions');
            if (!response.ok) {
                throw new Error('Failed to fetch sessions');
            }
            const data = await response.json();
            // Transform the data to include additional fields
            const transformedData = data.map((session: ChatSession) => ({
                ...session,
                indexed: Math.random() > 0.5, // Mock indexed status
                messageCount: session.history?.length || 0,
                lastActivity: session.created_at // Using created_at as lastActivity for now
            }));
            setSessions(transformedData);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const deleteSession = async (sessionId: string) => {
        try {
            const response = await fetch(`/api/chat/session/${sessionId}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete session');
            }
            
            await fetchSessions();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete session');
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const filteredSessions = sessions
        .filter((session) => {
            const matchesSearch = session.title.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesIndexed =
                indexedFilter === "all" ||
                (indexedFilter === "indexed" && session.indexed) ||
                (indexedFilter === "not-indexed" && !session.indexed);
            return matchesSearch && matchesIndexed;
        })
        .sort((a, b) => {
            if (sortBy === "newest") {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            } else if (sortBy === "oldest") {
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            } else if (sortBy === "activity") {
                return new Date(b.lastActivity || b.created_at).getTime() - 
                       new Date(a.lastActivity || a.created_at).getTime();
            }
            return 0;
        });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const handleSessionClick = (sessionId: string) => {
        setSelectedSessionId(sessionId);
    };

    const handleBackToList = () => {
        setSelectedSessionId(null);
    };

    if (selectedSessionId) {
        return (
            <SessionDetail 
                sessionId={selectedSessionId} 
                onBack={handleBackToList}
            />
        );
    }

    return (
        <div className="mt-10">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Chat Sessions</h1>
                    <p className="">Manage and review your conversation sessions</p>
                </div>

                {/* Filters and Search */}
                <div className="rounded-lg shadow-sm border p-6 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" />
                                <Input
                                    placeholder="Search sessions..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <Select value={indexedFilter} onValueChange={setIndexedFilter}>
                            <SelectTrigger className="w-full md:w-48">
                                <Database className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sessions</SelectItem>
                                <SelectItem value="indexed">Indexed Only</SelectItem>
                                <SelectItem value="not-indexed">Not Indexed</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-full md:w-48">
                                <Calendar className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest First</SelectItem>
                                <SelectItem value="oldest">Oldest First</SelectItem>
                                <SelectItem value="activity">Recent Activity</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button 
                            onClick={createNewSession}
                            className="flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            New Chat
                        </Button>
                    </div>
                </div>

                {/* Sessions List */}
                <div className="space-y-4">
                    {loading && <p className="">Loading...</p>}
                    {error && <p className="text-red-400">{error}</p>}
                    
                    {filteredSessions.map((session) => (
                        <Card 
                            key={session.id} 
                            className="relative hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => handleSessionClick(session.id)}
                        >
                            <button 
                                className="absolute top-2 right-4 hover:text-red-400"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSession(session.id);
                                }}
                            >
                                ×
                            </button>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <h3 className="text-lg font-semibold">{session.title}</h3>
                                        <Badge variant={session.indexed ? "default" : "secondary"}>
                                            {session.indexed ? "Indexed" : "Not Indexed"}
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center space-x-4">
                                        <span>Created: {formatDate(session.created_at)}</span>
                                        <span>Messages: {session.messageCount}</span>
                                    </div>
                                    <span>Last activity: {formatDate(session.lastActivity || session.created_at)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {!loading && filteredSessions.length === 0 && (
                    <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                            <Database className="h-12 w-12 mx-auto" />
                        </div>
                        <h3 className="text-lg font-medium mb-2">No sessions found</h3>
                        <p className="">Try adjusting your search or filter criteria</p>
                    </div>
                )}
            </div>
        </div>
    );
}