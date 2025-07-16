import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, BookOpen, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, onValue } from "firebase/database";
import { User } from "firebase/auth"; // Directly import from Firebase auth

// Day mapping for proper capitalization
const DAY_MAP: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun"
};

export default function StatsCard() {
  const [user, setUser] = useState<User | null>(null); // Correctly typed now
  const [stats, setStats] = useState({
    studyPartners: 0,
    sessionsJoined: 0,
    totalStudyHours: 0,
    currentWeekHours: 0
  });
  
  const [weeklyData, setWeeklyData] = useState<
    { day: string; hours: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Initialize Firebase Realtime Database
  const db = getDatabase();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    
    try {
      // Fetch user stats from Firebase Realtime Database
      const userStatsRef = ref(db, `userStats/${user.uid}`);
      onValue(userStatsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setStats({
            studyPartners: data.studyPartners || 0,
            sessionsJoined: data.sessionsJoined || 0,
            totalStudyHours: Math.round(data.totalStudyHours || 0),
            currentWeekHours: Math.round(data.currentWeekHours || 0)
          });

          // Process weekly data from Firebase
          const weeklyHours = data.weeklyHours || {};
          const formattedData = Object.entries(weeklyHours).map(([day, hours]) => ({
            day: DAY_MAP[day] || day.charAt(0).toUpperCase() + day.slice(1),
            hours: hours as number
          }));

          // Ensure we always have 7 days
          const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          const fullWeekData = days.map(day => {
            const existing = formattedData.find(d => d.day === day);
            return existing || { day, hours: 0 };
          });

          setWeeklyData(fullWeekData);
        } else {
          // Initialize with empty values if no data exists
          setWeeklyData([
            { day: "Mon", hours: 0 },
            { day: "Tue", hours: 0 },
            { day: "Wed", hours: 0 },
            { day: "Thu", hours: 0 },
            { day: "Fri", hours: 0 },
            { day: "Sat", hours: 0 },
            { day: "Sun", hours: 0 }
          ]);
        }
        setLoading(false);
      }, (error) => {
        console.error("Firebase read error:", error);
        setLoading(false);
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      setLoading(false);
    }
  }, [user, db]);

  const maxHours = Math.max(1, ...weeklyData.map(d => d.hours));

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Study Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-32 rounded-lg" />
          </CardContent>
        </Card>

        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Weekly Study Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-8 w-full mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Study Statistics */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Study Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.studyPartners}
              </div>
              <div className="text-sm text-muted-foreground">Study Partners</div>
            </div>
            
            <div className="text-center p-4 bg-gradient-to-br from-success/10 to-success/5 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-success" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.sessionsJoined}
              </div>
              <div className="text-sm text-muted-foreground">Sessions Joined</div>
            </div>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-accent/10 to-accent/5 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalStudyHours}
            </div>
            <div className="text-sm text-muted-foreground">Total Study Hours</div>
            <Badge variant="secondary" className="mt-2">
              +{stats.currentWeekHours} this week
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Study Chart */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Weekly Study Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-end gap-2 h-32">
              {weeklyData.map((data) => (
                <div key={data.day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="relative w-full bg-muted/30 rounded-t-sm overflow-hidden">
                    <div 
                      className="bg-gradient-to-t from-primary to-primary/70 rounded-t-sm transition-all duration-300"
                      style={{ 
                        height: `${(data.hours / maxHours) * 100}%`,
                        minHeight: data.hours > 0 ? '8px' : '0px'
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">{data.day}</div>
                  <div className="text-xs font-medium text-foreground">
                    {Math.round(data.hours)}h
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                This week: <span className="font-medium text-foreground">
                  {stats.currentWeekHours} hours
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Average: {(stats.currentWeekHours / 7).toFixed(1)}h per day
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}