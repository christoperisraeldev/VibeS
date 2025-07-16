import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Video, Calendar, Clock, Users, MapPin, Play, Settings, Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { database, auth } from "@/lib/firebaseClient";
import { ref, onValue, push, set } from "firebase/database"; // Corrected Firebase imports

// Define Session type with Firebase structure
type Session = {
  id: string;
  title: string;
  subject: string;
  host: string;
  participants: string[];
  date: string;
  time: string;
  start_time?: string;
  end_time?: string;
  location: string;
  type: 'online' | 'in-person';
  status: 'upcoming' | 'ongoing' | 'completed';
  description: string;
  created_at?: string;
};

export default function Sessions() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newSession, setNewSession] = useState({
    title: "",
    subject: "",
    description: "",
    date: "",
    start_time: "",
    end_time: "",
    location: "",
    type: "online" as 'online' | 'in-person',
    status: "upcoming" as 'upcoming' | 'ongoing' | 'completed'
  });
  const [loading, setLoading] = useState(true);

  // Fetch sessions from Firebase Realtime DB
  useEffect(() => {
    const sessionsRef = ref(database, 'sessions');
    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const sessionsData: Session[] = [];
        snapshot.forEach((childSnapshot) => {
          const session = childSnapshot.val();
          sessionsData.push({
            id: childSnapshot.key as string,
            title: session.title,
            subject: session.subject,
            host: session.host,
            participants: session.participants || [],
            date: session.date,
            time: session.time,
            start_time: session.start_time,
            end_time: session.end_time,
            location: session.location,
            type: session.type,
            status: session.status,
            description: session.description,
            created_at: session.created_at
          });
        });
        setSessions(sessionsData);
      } else {
        setSessions([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching sessions:", error);
      toast({
        title: "Error",
        description: "Failed to load sessions",
        variant: "destructive"
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         session.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "all" || session.status === activeTab;
    return matchesSearch && matchesTab;
  });

  // Calculate session statistics
  const upcomingCount = sessions.filter(s => s.status === "upcoming").length;
  const ongoingCount = sessions.filter(s => s.status === "ongoing").length;
  const completedCount = sessions.filter(s => s.status === "completed").length;
  
  const totalHours = sessions.reduce((total, session) => {
    if (session.start_time && session.end_time) {
      const start = new Date(`1970-01-01T${session.start_time}`);
      const end = new Date(`1970-01-01T${session.end_time}`);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return total + duration;
    }
    return total;
  }, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming": return "text-primary";
      case "ongoing": return "text-success";
      case "completed": return "text-muted-foreground";
      default: return "text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "upcoming": return "default";
      case "ongoing": return "secondary";
      case "completed": return "outline";
      default: return "outline";
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const adjustedHours = hours % 12 || 12;
    return `${adjustedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const handleCreateSession = async () => {
    if (!newSession.title || !newSession.subject || !newSession.date || 
        !newSession.start_time || !newSession.end_time) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Get current user info
      const user = auth.currentUser;
      const hostName = user ? (user.displayName || user.email || "You") : "You";
      
      // Format time for display
      const time = `${formatTime(newSession.start_time)} - ${formatTime(newSession.end_time)}`;
      
      // Create session data
      const sessionData = {
        ...newSession,
        time,
        host: hostName,
        participants: [],
        created_at: new Date().toISOString()
      };

      // Push to Firebase
      const newSessionRef = push(ref(database, 'sessions'));
      await set(newSessionRef, sessionData);

      toast({
        title: "Session Created",
        description: `${newSession.title} has been scheduled successfully.`,
      });

      setShowNewSessionModal(false);
      setNewSession({
        title: "",
        subject: "",
        description: "",
        date: "",
        start_time: "",
        end_time: "",
        location: "",
        type: "online",
        status: "upcoming"
      });
    } catch (error) {
      console.error("Error creating session:", error);
      toast({
        title: "Error",
        description: "Failed to create session",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    const today = new Date();
    const inputDate = new Date(dateString);
    
    // Reset time parts for comparison
    today.setHours(0, 0, 0, 0);
    inputDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.round((inputDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < 0) return `Last ${inputDate.toLocaleDateString('en-US', { weekday: 'long' })}`;
    
    return inputDate.toLocaleDateString('en-US', { weekday: 'long' });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
                ← Back to Dashboard
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setShowNewSessionModal(true)}
              >
                <Plus className="h-4 w-4" />
                New Session
              </Button>
              <Button 
                variant="outline" 
                className="gap-2 border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                asChild
              >
                <Link to="/scheduler">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
              <Video className="h-8 w-8 text-primary" />
              Study Sessions
            </h1>
            <p className="text-muted-foreground">
              Manage your virtual and in-person study sessions
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions by title or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Session Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-4">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="shadow-medium">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{upcomingCount}</p>
                      <p className="text-sm text-muted-foreground">Upcoming</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success/20 rounded-lg">
                      <Play className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{ongoingCount}</p>
                      <p className="text-sm text-muted-foreground">Ongoing</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/20 rounded-lg">
                      <Users className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{Math.round(totalHours)}</p>
                      <p className="text-sm text-muted-foreground">Total Hours</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted/40 rounded-lg">
                      <Video className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{completedCount}</p>
                      <p className="text-sm text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sessions List */}
            <div className="space-y-4">
              {loading ? (
                <Card className="shadow-medium">
                  <CardContent className="p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Loading sessions...</h3>
                    <p className="text-muted-foreground">
                      Fetching your study sessions
                    </p>
                  </CardContent>
                </Card>
              ) : filteredSessions.length === 0 ? (
                <Card className="shadow-medium">
                  <CardContent className="p-8 text-center">
                    <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No sessions found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery ? "Try adjusting your search terms" : "Start by creating your first study session"}
                    </p>
                    <Button className="gap-2" onClick={() => setShowNewSessionModal(true)}>
                      <Plus className="h-4 w-4" />
                      Create New Session
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredSessions.map((session) => (
                  <Card key={session.id} className="shadow-medium hover:shadow-large transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground mb-1">{session.title}</h3>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <Badge variant="outline" className="text-primary border-primary">
                                  {session.subject}
                                </Badge>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {formatDate(session.date)}, {session.time}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {session.location}
                                </span>
                              </div>
                            </div>
                            <Badge variant={getStatusBadge(session.status)} className={getStatusColor(session.status)}>
                              {session.status}
                            </Badge>
                          </div>

                          <p className="text-foreground mb-4">{session.description}</p>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Host:</span>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                                    {session.host.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium text-foreground">{session.host}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Participants:</span>
                              <div className="flex -space-x-2">
                                {session.participants?.slice(0, 3).map((participant, index) => (
                                  <Avatar key={index} className="h-6 w-6 border-2 border-background">
                                    <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                                      {participant.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                                {session.participants?.length > 3 && (
                                  <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs text-muted-foreground">
                                    +{session.participants.length - 3}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {session.status === "upcoming" && (
                            <>
                              <Button variant="outline" className="gap-2" asChild>
                                <Link to={`/chat/${session.id}`}>
                                  <Users className="h-4 w-4" />
                                  Chat
                                </Link>
                              </Button>
                              <Button className="gap-2" asChild>
                                <Link to={`/video-session/${session.id}`}>
                                  <Play className="h-4 w-4" />
                                  Join Session
                                </Link>
                              </Button>
                            </>
                          )}
                          {session.status === "ongoing" && (
                            <Button className="gap-2" asChild>
                              <Link to={`/video-session/${session.id}`}>
                                <Play className="h-4 w-4" />
                                Join Now
                              </Link>
                            </Button>
                          )}
                          {session.status === "completed" && (
                            <Button variant="outline" className="gap-2">
                              <Calendar className="h-4 w-4" />
                              Schedule Again
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* New Session Modal */}
        <Dialog open={showNewSessionModal} onOpenChange={setShowNewSessionModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Study Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Session Title *</Label>
                <Input
                  id="title"
                  value={newSession.title}
                  onChange={(e) => setNewSession(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Calculus Problem Solving"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Select 
                  value={newSession.subject} 
                  onValueChange={(value) => setNewSession(prev => ({ ...prev, subject: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                    <SelectItem value="Physics">Physics</SelectItem>
                    <SelectItem value="Chemistry">Chemistry</SelectItem>
                    <SelectItem value="Biology">Biology</SelectItem>
                    <SelectItem value="Psychology">Psychology</SelectItem>
                    <SelectItem value="Statistics">Statistics</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newSession.description}
                  onChange={(e) => setNewSession(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what you'll cover..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={newSession.date}
                  onChange={(e) => setNewSession(prev => ({ ...prev, date: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={newSession.start_time}
                    onChange={(e) => setNewSession(prev => ({ ...prev, start_time: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time *</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={newSession.end_time}
                    onChange={(e) => setNewSession(prev => ({ ...prev, end_time: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="type">Session Type</Label>
                <Select 
                  value={newSession.type} 
                  onValueChange={(value) => setNewSession(prev => ({
                    ...prev, 
                    type: value as 'online' | 'in-person'
                  }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="in-person">In-Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newSession.type === "in-person" && (
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={newSession.location}
                    onChange={(e) => setNewSession(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., Library Room 204"
                    className="mt-1"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowNewSessionModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleCreateSession} className="flex-1">
                  Create Session
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}