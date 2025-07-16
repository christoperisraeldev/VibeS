import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, Plus, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { getDatabase, ref, onValue, set, push, update } from "firebase/database";
import { auth } from "@/lib/firebaseClient"; // Removed db import from here
import { onAuthStateChanged, User } from "firebase/auth";

// Initialize Firebase database
const db = getDatabase();

interface SessionParticipant {
  userId: string;
  status: string;
}

interface Session {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  subject: string;
  invited_partner: string;
  creator_id: string;
  participants: Record<string, SessionParticipant>;
  description?: string;
}

interface SessionSummary {
  id: string;
  time: string;
  title: string;
  status: string;
  partner: string;
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

export default function SchedulerView() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionDetails, setSessionDetails] = useState({
    title: "",
    description: "",
    partner: "",
    subject: ""
  });
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [sessionsByDate, setSessionsByDate] = useState<Record<string, SessionSummary[]>>({});
  const [weekDates, setWeekDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Get current week dates
  const getCurrentWeekDates = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date.toISOString().split('T')[0];
    });
  };

  // Fetch sessions from Firebase
  const fetchSessions = useCallback(() => {
    if (!currentUser?.uid) return;
    
    setLoading(true);
    try {
      const sessionsRef = ref(db, 'study_sessions');
      const unsubscribe = onValue(sessionsRef, (snapshot) => {
        const sessionsData: Record<string, Session> = snapshot.val() || {};
        const sessionList: Session[] = Object.entries(sessionsData).map(
          ([id, session]) => ({ ...session, id })
        );
        
        // Filter sessions where current user is participant or creator
        const userSessions = sessionList.filter(session => 
          session.creator_id === currentUser.uid || 
          (session.participants && session.participants[currentUser.uid])
        );
        
        setSessions(userSessions);
        
        // Filter upcoming sessions (confirmed or pending)
        const upcoming = userSessions
          .filter(s => s.status !== 'available' && new Date(s.start_time) > new Date())
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        
        setUpcomingSessions(upcoming);
        
        // Organize sessions by date
        const byDate: Record<string, SessionSummary[]> = {};
        userSessions.forEach(session => {
          const date = session.start_time.split('T')[0];
          if (!byDate[date]) byDate[date] = [];
          
          byDate[date].push({
            id: session.id,
            time: new Date(session.start_time).toTimeString().slice(0, 5),
            title: session.title,
            status: session.status,
            partner: session.invited_partner
          });
        });
        
        setSessionsByDate(byDate);
        setLoading(false);
      }, (error) => {
        console.error("Firebase read error:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast({
        title: "Error",
        description: "Could not fetch sessions",
        variant: "destructive"
      });
      setLoading(false);
    }
  }, [currentUser, toast]);

  // Initialize week dates
  useEffect(() => {
    const dates = getCurrentWeekDates();
    setWeekDates(dates);
    setSelectedDate(dates[0]);
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  // Fetch sessions when user or week changes
  useEffect(() => {
    if (weekDates.length > 0 && currentUser?.uid) {
      fetchSessions();
    }
  }, [currentUser, weekDates, fetchSessions]);

  // Status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800 border-green-200";
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "available": return "bg-blue-100 text-blue-800 border-blue-200";
      case "conflict": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Handle time slot selection
  const handleTimeSlotClick = (date: string, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setShowSessionModal(true);
  };

  // Create a new session
  const handleCreateSession = async () => {
    if (!sessionDetails.title || !sessionDetails.partner) {
      toast({
        title: "Missing Information",
        description: "Please fill in the session title and partner.",
        variant: "destructive"
      });
      return;
    }

    if (!currentUser) {
      toast({
        title: "Authentication Error",
        description: "You must be signed in to create a session.",
        variant: "destructive"
      });
      return;
    }

    try {
      const startTime = new Date(`${selectedDate}T${selectedTime}:00Z`);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour session
      
      const sessionRef = push(ref(db, 'study_sessions'));
      const newSession: Session = {
        id: sessionRef.key || '',
        title: sessionDetails.title,
        description: sessionDetails.description,
        subject: sessionDetails.subject,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: "pending",
        invited_partner: sessionDetails.partner,
        creator_id: currentUser.uid,
        participants: {
          [currentUser.uid]: {
            userId: currentUser.uid,
            status: "accepted"
          }
        }
      };
      
      await set(sessionRef, newSession);

      toast({
        title: "Session Proposed",
        description: `Study session request sent to ${sessionDetails.partner}`,
      });

      setShowSessionModal(false);
      setSessionDetails({ title: "", description: "", partner: "", subject: "" });
    } catch (error) {
      console.error("Error creating session:", error);
      toast({
        title: "Error",
        description: "Could not create session",
        variant: "destructive"
      });
    }
  };

  // Handle session status update
  const handleSessionStatus = async (sessionId: string, status: string) => {
    if (!currentUser) return;
    
    try {
      const sessionRef = ref(db, `study_sessions/${sessionId}`);
      
      // Update session status
      await update(sessionRef, {
        status: status === "confirmed" ? "confirmed" : "declined"
      });
      
      // Update user's participant status
      await update(ref(db, `study_sessions/${sessionId}/participants/${currentUser.uid}`), {
        status: status === "confirmed" ? "accepted" : "rejected"
      });

      toast({
        title: status === "confirmed" ? "Session Confirmed" : "Session Declined",
        description: status === "confirmed" 
          ? "You've confirmed this session" 
          : "You've declined this session",
      });
    } catch (error) {
      console.error("Error updating session status:", error);
      toast({
        title: "Error",
        description: "Could not update session status",
        variant: "destructive"
      });
    }
  };

  // Initialize week dates on mount
  if (weekDates.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-8 gap-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
            {[...Array(80)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Study Scheduler</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <Clock className="h-4 w-4" />
              Sync Calendar
            </Button>
            <Button 
              className="gap-2"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setSelectedDate(today);
                setSelectedTime("14:00");
                setShowSessionModal(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New Session
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Weekly View</span>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Confirmed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span>Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Available</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-8 gap-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
                {[...Array(80)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-2">
                {/* Time column header */}
                <div className="font-semibold text-center p-2">Time</div>
                
                {/* Day headers */}
                {WEEK_DAYS.map((day, index) => (
                  <div key={day} className="font-semibold text-center p-2">
                    <div>{day}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(weekDates[index]).getDate()}
                    </div>
                  </div>
                ))}

                {/* Time slots */}
                {TIME_SLOTS.map((time) => (
                  <>
                    <div key={time} className="text-sm text-muted-foreground p-2 text-center border-r border-border">
                      {time}
                    </div>
                    {weekDates.map((date) => {
                      const session = sessionsByDate[date]?.find(s => s.time === time);
                      return (
                        <div
                          key={`${date}-${time}`}
                          className="min-h-12 border border-border rounded cursor-pointer hover:bg-accent/50 transition-colors flex items-center justify-center p-1"
                          onClick={() => handleTimeSlotClick(date, time)}
                        >
                          {session ? (
                            <Badge variant="outline" className={`text-xs ${getStatusColor(session.status)} w-full text-center`}>
                              <div className="flex flex-col">
                                <span className="font-medium">{session.title}</span>
                                {session.partner && (
                                  <span className="text-xs opacity-75">{session.partner}</span>
                                )}
                              </div>
                            </Badge>
                          ) : (
                            <div className="text-xs text-muted-foreground opacity-50">+</div>
                          )}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Sessions */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map(session => {
                  const date = session.start_time.split('T')[0];
                  const time = new Date(session.start_time).toTimeString().slice(0, 5);
                  
                  return (
                    <div key={session.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-sm">
                          <div className="font-medium">{session.title}</div>
                          <div className="text-muted-foreground">
                            {new Date(date).toLocaleDateString()} at {time}
                            {session.invited_partner && ` with ${session.invited_partner}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={session.status === 'confirmed' ? 'default' : 'secondary'}>
                          {session.status}
                        </Badge>
                        {session.status === 'pending' && session.creator_id !== currentUser?.uid && (
                          <div className="flex gap-1">
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8"
                              onClick={() => handleSessionStatus(session.id, "confirmed")}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8"
                              onClick={() => handleSessionStatus(session.id, "declined")}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Creation Modal */}
        <Dialog open={showSessionModal} onOpenChange={setShowSessionModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Schedule Study Session
                <div className="text-sm text-muted-foreground font-normal">
                  {selectedDate} at {selectedTime}
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="session-title">Session Title *</Label>
                <Input
                  id="session-title"
                  value={sessionDetails.title}
                  onChange={(e) => setSessionDetails(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Calculus Study Session"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="partner">Study Partner *</Label>
                <Input
                  id="partner"
                  value={sessionDetails.partner}
                  onChange={(e) => setSessionDetails(prev => ({ ...prev, partner: e.target.value }))}
                  placeholder="Enter partner's name or email"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={sessionDetails.subject}
                  onChange={(e) => setSessionDetails(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g., Mathematics"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="session-description">Message (Optional)</Label>
                <Textarea
                  id="session-description"
                  value={sessionDetails.description}
                  onChange={(e) => setSessionDetails(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add a message for your study partner..."
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowSessionModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleCreateSession} className="flex-1">
                  Send Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}