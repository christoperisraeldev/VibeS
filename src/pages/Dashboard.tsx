import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Users, BookOpen, MessageCircle, User, Calendar, Trophy, TrendingUp, Video, Settings, Home, Bell, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ref, onValue } from "firebase/database";
import { auth, database } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";

interface UserProfile {
  studyField: string;
  subjects: string[];
  languages: string[];
  studyStyles: string[];
  bio: string;
  connections?: string[];
  sessions?: string[];
}

interface Match {
  id: string;
  name: string;
  subject: string;
  compatibility: number;
  avatar?: string;
}

interface Session {
  id: string;
  subject: string;
  participants: Record<string, boolean>;
  time: string;
  location: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch user profile
        const profileRef = ref(database, `users/${user.uid}`);
        onValue(profileRef, (snapshot) => {
          const profileData = snapshot.val();
          if (profileData) {
            setUserProfile(profileData);
            
            // Calculate connections count
            const connections = profileData.connections || [];
            setConnectionsCount(connections.length);
            
            // Calculate sessions count
            const sessions = profileData.sessions || [];
            setSessionsCount(sessions.length);
          }
        });

        // Fetch recent matches
        const matchesRef = ref(database, `matches/${user.uid}`);
        onValue(matchesRef, (snapshot) => {
          const matchesData = snapshot.val();
          if (matchesData) {
            // Transform matches data into typed array
            const matchesArray: Match[] = Object.entries(matchesData).map(([key, value]) => ({
              id: key,
              ...(value as Omit<Match, 'id'>)
            }));
            setRecentMatches(matchesArray.slice(0, 3));
          }
        });

        // Fetch upcoming sessions
        const sessionsRef = ref(database, `sessions`);
        onValue(sessionsRef, (snapshot) => {
          const sessionsData = snapshot.val();
          if (sessionsData) {
            // Transform sessions data into typed array
            const sessionsArray: Session[] = Object.entries(sessionsData).map(([key, value]) => ({
              id: key,
              ...(value as Omit<Session, 'id'>)
            }));
            
            // Filter sessions where current user is a participant
            const userSessions = sessionsArray.filter(session => 
              session.participants && session.participants[user.uid]
            );
            setUpcomingSessions(userSessions.slice(0, 3));
          }
        });
      }
    });

    return () => unsubscribe();
  }, []);

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Top Navigation Bar */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-primary rounded-xl shadow-glow">
                  <BookOpen className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <h1 className="ml-3 text-xl font-bold text-foreground">VibeS</h1>
            </div>

            {/* Center Navigation */}
            <nav className="hidden md:flex space-x-8">
              <Link 
                to="/dashboard" 
                className="flex items-center px-3 py-2 rounded-lg text-primary bg-primary/10 font-medium transition-all duration-200"
              >
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
              <Link 
                to="/smart-matching" 
                className="flex items-center px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium transition-all duration-200"
              >
                <Radar className="w-4 h-4 mr-2" />
                Smart Matching
              </Link>
              <Link 
                to="/chat" 
                className="flex items-center px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium transition-all duration-200"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Messages
              </Link>
              <Link 
                to="/sessions" 
                className="flex items-center px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium transition-all duration-200"
              >
                <Video className="w-4 h-4 mr-2" />
                Sessions
              </Link>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center space-x-4">
              <Button asChild variant="ghost" size="sm" className="relative">
                <Link to="/notifications">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full"></span>
                </Link>
              </Button>
              <Link to="/profile">
                <Avatar className="w-8 h-8 hover:scale-105 transition-transform cursor-pointer">
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm font-semibold">
                    {userProfile.studyField?.substring(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Welcome back! 👋
            </h2>
            <p className="text-muted-foreground">
              Ready to find your perfect study partner today?
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button asChild className="gap-2 hover:scale-105 transition-all duration-200 shadow-lg">
              <Link to="/smart-matching">
                <div className="p-1 bg-white/20 rounded-full">
                  <Radar className="h-4 w-4" />
                </div>
                Find Partners
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2 hover:scale-105 transition-all duration-200">
              <Link to="/profile">
                <div className="p-1 bg-primary/20 rounded-full">
                  <User className="h-4 w-4" />
                </div>
                My Profile
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Study Partners Card */}
          <Card className="group shadow-medium hover:shadow-large hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-primary/20 rounded-2xl group-hover:bg-primary/30 transition-all duration-300 transform group-hover:scale-110" style={{
                  boxShadow: '0 8px 16px -4px rgba(var(--primary), 0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}>
                  <Users className="h-7 w-7 text-primary drop-shadow-sm" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{connectionsCount}</p>
                  <p className="text-sm text-muted-foreground">Study Partners</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sessions Card */}
          <Card className="group shadow-medium hover:shadow-large hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-accent/20 rounded-2xl group-hover:bg-accent/30 transition-all duration-300 transform group-hover:scale-110" style={{
                  boxShadow: '0 8px 16px -4px rgba(var(--accent), 0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}>
                  <Video className="h-7 w-7 text-accent drop-shadow-sm" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{sessionsCount}</p>
                  <p className="text-sm text-muted-foreground">Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Success Rate Card */}
          <Card className="group shadow-medium hover:shadow-large hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-green-500/20 rounded-2xl group-hover:bg-green-500/30 transition-all duration-300 transform group-hover:scale-110" style={{
                  boxShadow: '0 8px 16px -4px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}>
                  <Trophy className="h-7 w-7 text-green-600 drop-shadow-sm" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {connectionsCount > 0 ? `${Math.min(95, 70 + Math.floor(connectionsCount * 5))}%` : '0%'}
                  </p>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Study Time Card */}
          <Card className="group shadow-medium hover:shadow-large hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-orange-500/5 to-orange-500/10 border-orange-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-orange-500/20 rounded-2xl group-hover:bg-orange-500/30 transition-all duration-300 transform group-hover:scale-110" style={{
                  boxShadow: '0 8px 16px -4px rgba(249, 115, 22, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}>
                  <TrendingUp className="h-7 w-7 text-orange-600 drop-shadow-sm" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {sessionsCount > 0 ? `${sessionsCount * 3}h` : '0h'}
                  </p>
                  <p className="text-sm text-muted-foreground">Study Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Link to="/smart-matching" className="group">
            <Card className="shadow-medium hover:shadow-large hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
              <CardContent className="p-6 text-center">
                <div className="p-4 bg-blue-500/20 rounded-2xl inline-flex group-hover:bg-blue-500/30 transition-all duration-300 transform group-hover:scale-110 mb-4" style={{
                  boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}>
                  <Radar className="h-8 w-8 text-blue-600 drop-shadow-sm" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Find Study Partners</h3>
                <p className="text-sm text-muted-foreground">Discover students with similar interests and schedules</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/chat" className="group">
            <Card className="shadow-medium hover:shadow-large hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
              <CardContent className="p-6 text-center">
                <div className="p-4 bg-purple-500/20 rounded-2xl inline-flex group-hover:bg-purple-500/30 transition-all duration-300 transform group-hover:scale-110 mb-4" style={{
                  boxShadow: '0 8px 16px -4px rgba(168, 85, 247, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}>
                  <MessageCircle className="h-8 w-8 text-purple-600 drop-shadow-sm" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Messages & Chat</h3>
                <p className="text-sm text-muted-foreground">Connect and plan study sessions with your partners</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/sessions" className="group">
            <Card className="shadow-medium hover:shadow-large hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20 w-full">
              <CardContent className="p-6 text-center">
                <div className="p-4 bg-emerald-500/20 rounded-2xl inline-flex group-hover:bg-emerald-500/30 transition-all duration-300 transform group-hover:scale-110 mb-4" style={{
                  boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}>
                  <Video className="h-8 w-8 text-emerald-600 drop-shadow-sm" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Video Sessions</h3>
                <p className="text-sm text-muted-foreground">Join or start live study sessions with your partners</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Matches */}
            <Card className="shadow-medium">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Recent Matches
                  </CardTitle>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/smart-matching">View All</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentMatches.length > 0 ? (
                  recentMatches.map((match) => (
                    <div key={match.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={match.avatar} />
                          <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                            {match.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-foreground">{match.name}</h3>
                          <p className="text-sm text-muted-foreground">{match.subject}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{match.compatibility}% Match</Badge>
                        <Button 
                          size="sm"
                          onClick={() => toast({
                            title: "Connection Request Sent",
                            description: `Sent a connection request to ${match.name}`,
                          })}
                        >
                          Connect
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">No recent matches yet</p>
                    <Button className="mt-3" asChild>
                      <Link to="/smart-matching">Find Study Partners</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Sessions */}
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Study Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {upcomingSessions.length > 0 ? (
                  upcomingSessions.map((session) => (
                    <div key={session.id} className="p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-foreground">{session.subject}</h3>
                        <Badge variant="outline">
                          {session.time}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        with {Object.keys(session.participants || {}).length} participants
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {session.location}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">No upcoming sessions</p>
                    <Button className="mt-3" asChild>
                      <Link to="/sessions">Schedule a Session</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="shadow-medium hover:shadow-large transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-primary/20 rounded-xl">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full justify-start gap-3 hover:scale-105 transition-all duration-200" variant="outline">
                  <Link to="/smart-matching">
                    <div className="p-1 bg-blue-500/20 rounded-md">
                      <Radar className="h-4 w-4 text-blue-600" />
                    </div>
                    Find Study Partners
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start gap-3 hover:scale-105 transition-all duration-200" variant="outline">
                  <Link to="/chat">
                    <div className="p-1 bg-purple-500/20 rounded-md">
                      <MessageCircle className="h-4 w-4 text-purple-600" />
                    </div>
                    Start Conversation
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start gap-3 hover:scale-105 transition-all duration-200" variant="outline">
                  <Link to="/profile">
                    <div className="p-1 bg-green-500/20 rounded-md">
                      <User className="h-4 w-4 text-green-600" />
                    </div>
                    Update Profile
                  </Link>
                </Button>
                <Button 
                  asChild
                  className="w-full justify-start gap-3 hover:scale-105 transition-all duration-200" 
                  variant="outline"
                >
                  <Link to="/sessions">
                    <div className="p-1 bg-orange-500/20 rounded-md">
                      <Calendar className="h-4 w-4 text-orange-600" />
                    </div>
                    Schedule Session
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Study Tips */}
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Study Tip of the Day</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-primary/5 rounded-lg border-l-4 border-primary">
                  <p className="text-sm text-foreground leading-relaxed">
                    💡 <strong>Active Recall:</strong> Instead of just re-reading notes, 
                    try explaining concepts to your study partner. Teaching others 
                    is one of the most effective ways to reinforce your own learning!
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Profile Completion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Profile Complete</span>
                    <span>
                      {userProfile ? 
                        `${Math.min(100, 20 + 
                         (userProfile.subjects?.length || 0) * 10 + 
                         (userProfile.languages?.length || 0) * 5)}%` 
                        : '0%'}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ 
                        width: userProfile ? 
                          `${Math.min(100, 20 + 
                          (userProfile.subjects?.length || 0) * 10 + 
                          (userProfile.languages?.length || 0) * 5)}%` 
                          : '0%' 
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {userProfile?.subjects?.length ? 
                      "Add more subjects and preferences to get better matches!" : 
                      "Complete your profile to get better matches!"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}