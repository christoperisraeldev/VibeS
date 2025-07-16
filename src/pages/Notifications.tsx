import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, X, Users, MessageCircle, Calendar, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Firebase imports - using centralized client
import { 
  ref, 
  onValue, 
  off, 
  update, 
  remove, 
  query, 
  orderByChild, 
  equalTo,
  DataSnapshot  // Add this import
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { database, auth } from "@/lib/firebaseClient";

// Notification type definition
interface Notification {
  id: string;
  type: "connection" | "session" | "message" | "system";
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  avatar: string | null;
  actionable: boolean;
  user_id: string;
}

export default function Notifications() {
  const [user, setUser] = useState(auth.currentUser);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [timeNow, setTimeNow] = useState(new Date());

  // Handle auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  // Force time updates every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeNow(new Date());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Format time difference for display
  const formatTimeAgo = (isoString: string): string => {
    const date = new Date(isoString);
    const seconds = Math.floor((timeNow.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
    
    const hours = Math.floor(seconds / 3600);
    if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    
    const days = Math.floor(seconds / 86400);
    if (days < 30) return days === 1 ? "1 day ago" : `${days} days ago`;
    
    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;
    
    const years = Math.floor(days / 365);
    return years === 1 ? "1 year ago" : `${years} years ago`;
  };

  // Fetch notifications and setup real-time updates
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const notificationsRef = query(
      ref(database, "notifications"),
      orderByChild("user_id"),
      equalTo(user.uid)
    );

    // Use DataSnapshot type instead of any
    const handleData = (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      const loadedNotifications: Notification[] = [];

      if (data) {
        Object.keys(data).forEach((key) => {
          loadedNotifications.push({
            id: key,
            ...data[key],
          });
        });

        // Sort by date (newest first)
        loadedNotifications.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }

      setNotifications(loadedNotifications);
      setLoading(false);
    };

    const unsubscribe = onValue(notificationsRef, handleData);

    // Cleanup function
    return () => {
      off(notificationsRef, 'value', handleData);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );

    // Update in Firebase
    const notificationRef = ref(database, `notifications/${id}`);
    await update(notificationRef, { read: true });
  };

  const markAllAsRead = async () => {
    if (!user) return;

    // Optimistic update
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );

    // Batch update in Firebase
    const updates: Record<string, boolean> = {};
    notifications
      .filter(notif => !notif.read)
      .forEach(notif => {
        updates[`notifications/${notif.id}/read`] = true;
      });

    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);
    }
  };

  const deleteNotification = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.filter(notif => notif.id !== id));

    // Remove from Firebase
    const notificationRef = ref(database, `notifications/${id}`);
    await remove(notificationRef);
  };

  const filteredNotifications = notifications.filter(notif => {
    if (activeTab === "unread") return !notif.read;
    if (activeTab === "actionable") return notif.actionable;
    return true; // "all"
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "connection": return <Users className="h-5 w-5 text-primary" />;
      case "session": return <Calendar className="h-5 w-5 text-accent" />;
      case "message": return <MessageCircle className="h-5 w-5 text-success" />;
      default: return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
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
              {unreadCount > 0 && (
                <Button onClick={markAllAsRead} variant="outline" className="gap-2">
                  <Check className="h-4 w-4" />
                  Mark All Read
                </Button>
              )}
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
              <Bell className="h-8 w-8 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-sm">
                  {unreadCount} new
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">
              Stay updated with your study partner activities
            </p>
          </div>
        </div>

        {/* Notification Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto">
            <TabsTrigger value="all" className="gap-2">
              All
              <Badge variant="secondary" className="text-xs">
                {notifications.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="unread" className="gap-2">
              Unread
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="actionable" className="gap-2">
              Action Required
              <Badge variant="secondary" className="text-xs">
                {notifications.filter(n => n.actionable).length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {loading ? (
              <Card className="shadow-medium">
                <CardContent className="p-8 text-center">
                  <div className="animate-pulse">
                    <div className="h-12 w-12 bg-muted rounded-full mx-auto mb-4" />
                    <div className="h-4 bg-muted rounded w-1/3 mx-auto mb-2" />
                    <div className="h-4 bg-muted rounded w-2/3 mx-auto" />
                  </div>
                </CardContent>
              </Card>
            ) : filteredNotifications.length === 0 ? (
              <Card className="shadow-medium">
                <CardContent className="p-8 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No notifications</h3>
                  <p className="text-muted-foreground">
                    {activeTab === "unread" 
                      ? "You're all caught up! No unread notifications."
                      : activeTab === "actionable"
                      ? "No actions required at the moment."
                      : "You don't have any notifications yet."
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredNotifications.map((notification) => (
                  <Card 
                    key={notification.id} 
                    className={`shadow-medium hover:shadow-large transition-all duration-300 ${
                      !notification.read ? 'border-primary/50 bg-primary/5' : ''
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="p-2 bg-muted/30 rounded-lg">
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-foreground">
                              {notification.title}
                              {!notification.read && (
                                <span className="ml-2 w-2 h-2 bg-primary rounded-full inline-block"></span>
                              )}
                            </h3>
                            <span className="text-sm text-muted-foreground flex-shrink-0">
                              {formatTimeAgo(notification.created_at)}
                            </span>
                          </div>
                          
                          <p className="text-foreground mb-4">
                            {notification.message}
                          </p>

                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markAsRead(notification.id)}
                                className="gap-2"
                              >
                                <Check className="h-4 w-4" />
                                Mark as Read
                              </Button>
                            )}
                            
                            {notification.actionable && (
                              <>
                                {notification.type === "connection" && (
                                  <>
                                    <Button size="sm" className="gap-2">
                                      <Check className="h-4 w-4" />
                                      Accept
                                    </Button>
                                    <Button size="sm" variant="outline" className="gap-2">
                                      <X className="h-4 w-4" />
                                      Decline
                                    </Button>
                                  </>
                                )}
                                {notification.type === "session" && (
                                  <Button size="sm" className="gap-2" asChild>
                                    <Link to="/sessions">
                                      <Calendar className="h-4 w-4" />
                                      View Session
                                    </Link>
                                  </Button>
                                )}
                              </>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteNotification(notification.id)}
                              className="gap-2 text-destructive hover:text-destructive ml-auto"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}