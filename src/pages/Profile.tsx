import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Edit3, Save, X, Camera, BookOpen, Globe, Clock, Target, LogOut, ArrowLeft } from "lucide-react";
import StatsCard from "@/components/profile/StatsCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { auth, database } from "@/lib/firebaseClient"; // Updated import
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from "firebase/auth";
import { ref, onValue, update } from "firebase/database";

interface ProfileData {
  name: string;
  email: string;
  bio: string;
  studyField: string;
  subjects: string[];
  languages: string[];
  studyTimes: string[];
  studyStyles: string[];
  profileImage: string;
}

const STUDY_FIELDS = [
  "Computer Science", "Engineering", "Medicine", "Business", "Psychology",
  "Mathematics", "Physics", "Chemistry", "Biology", "Literature",
  "History", "Art", "Music", "Law", "Economics", "Other"
];

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese", 
  "Chinese", "Japanese", "Korean", "Arabic", "Russian", "Dutch", "Hebrew", "Lithuanian", "Other"
];

const STUDY_TIMES = [
  "Early Morning (6-9 AM)", "Evening (5-8 PM)", "Night (8-11 PM)", "Late Night (11 PM-2 AM)", "Flexible"
];

const STUDY_STYLES = [
  "Visual Learner", "Auditory Learner", "Kinesthetic Learner", "Reading/Writing",
  "Group Study", "Solo Study", "Discussion-Based", "Practice-Heavy"
];

// Initial profile data
const initialProfileData: ProfileData = {
  name: "",
  email: "",
  bio: "",
  studyField: "",
  subjects: [],
  languages: [],
  studyTimes: [],
  studyStyles: [],
  profileImage: ""
};

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>(initialProfileData);
  const [editData, setEditData] = useState<ProfileData>(initialProfileData);
  const profileUnsubscribe = useRef<() => void>(() => {});

  // Fetch user session and profile
  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userId = user.uid;
        const userRef = ref(database, `users/${userId}`);
        
        // Unsubscribe previous listener
        if (profileUnsubscribe.current) {
          profileUnsubscribe.current();
        }
        
        // Set up real-time listener
        profileUnsubscribe.current = onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setProfileData(data);
            if (!isEditing) {
              setEditData(data);
            }
          } else {
            // Initialize new user profile
            const newProfile = {
              ...initialProfileData,
              name: user.displayName || "",
              email: user.email || ""
            };
            update(userRef, newProfile);
          }
        });
      } else {
        navigate('/login');
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe.current) {
        profileUnsubscribe.current();
      }
    };
  }, [navigate, isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast({
        title: "Save Failed",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    try {
      await update(ref(database, `users/${user.uid}`), editData);
      
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully saved.",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Save Failed",
        description: "Could not update your profile",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditData({ ...profileData });
    setIsEditing(false);
  };

  const handleSubjectAdd = (subject: string) => {
    if (subject.trim() && !editData.subjects.includes(subject.trim())) {
      setEditData(prev => ({
        ...prev,
        subjects: [...prev.subjects, subject.trim()]
      }));
    }
  };

  const handleSubjectRemove = (subject: string) => {
    setEditData(prev => ({
      ...prev,
      subjects: prev.subjects.filter(s => s !== subject)
    }));
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      navigate('/login');
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: "Sign Out Failed",
        description: "Could not sign out properly",
        variant: "destructive",
      });
    }
  };

  const toggleSelection = (array: string[], item: string, field: keyof ProfileData) => {
    const newSelection = array.includes(item)
      ? array.filter(i => i !== item)
      : [...array, item];
    
    setEditData(prev => ({
      ...prev,
      [field]: newSelection
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link 
            to="/dashboard" 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
            
            {!isEditing ? (
              <Button onClick={handleEdit} className="gap-2">
                <Edit3 className="h-4 w-4" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleSave} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
                <Button onClick={handleCancel} variant="outline" className="gap-2">
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Profile Header Card */}
        <Card className="shadow-medium">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Profile Picture */}
              <div className="relative">
                <Avatar className="h-24 w-24 md:h-32 md:w-32">
                  <AvatarImage src={profileData.profileImage} />
                  <AvatarFallback className="text-2xl bg-gradient-primary text-primary-foreground">
                    {profileData.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <Button
                    size="icon"
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full shadow-medium"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Basic Info */}
              <div className="flex-1 space-y-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={editData.name}
                        onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={editData.bio}
                        onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                        className="mt-1 min-h-20"
                        placeholder="Tell others about yourself and your study interests..."
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{profileData.name}</h2>
                      <p className="text-muted-foreground">{profileData.email}</p>
                    </div>
                    <p className="text-foreground leading-relaxed">{profileData.bio}</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Study Statistics */}
        <StatsCard />

        {/* Study Information */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Study Field & Subjects */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Academic Focus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <Label>Study Field</Label>
                    <select
                      value={editData.studyField}
                      onChange={(e) => setEditData(prev => ({ ...prev, studyField: e.target.value }))}
                      className="w-full mt-1 p-2 rounded-md border border-input bg-background"
                    >
                      {STUDY_FIELDS.map(field => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Current Subjects</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editData.subjects.map(subject => (
                        <Badge key={subject} variant="secondary" className="gap-1">
                          {subject}
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-destructive" 
                            onClick={() => handleSubjectRemove(subject)}
                          />
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Add a subject and press Enter"
                      className="mt-2"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSubjectAdd(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Study Field</h3>
                    <Badge variant="outline" className="text-primary border-primary">
                      {profileData.studyField}
                    </Badge>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Current Subjects</h3>
                    <div className="flex flex-wrap gap-2">
                      {profileData.subjects.map(subject => (
                        <Badge key={subject} variant="secondary">
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Languages */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Languages
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGES.map(language => (
                    <label key={language} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-accent-soft">
                      <input
                        type="checkbox"
                        checked={editData.languages.includes(language)}
                        onChange={() => toggleSelection(editData.languages, language, 'languages')}
                        className="rounded border-input"
                      />
                      <span className="text-sm">{language}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profileData.languages.map(language => (
                    <Badge key={language} variant="outline">
                      {language}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Study Preferences */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Study Times */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Preferred Study Times
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-2">
                  {STUDY_TIMES.map(time => (
                    <label key={time} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-accent-soft">
                      <input
                        type="checkbox"
                        checked={editData.studyTimes.includes(time)}
                        onChange={() => toggleSelection(editData.studyTimes, time, 'studyTimes')}
                        className="rounded border-input"
                      />
                      <span className="text-sm">{time}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {profileData.studyTimes.map(time => (
                    <Badge key={time} variant="secondary" className="block w-fit">
                      {time}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Study Styles */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Learning Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="grid grid-cols-1 gap-2">
                  {STUDY_STYLES.map(style => (
                    <label key={style} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-accent-soft">
                      <input
                        type="checkbox"
                        checked={editData.studyStyles.includes(style)}
                        onChange={() => toggleSelection(editData.studyStyles, style, 'studyStyles')}
                        className="rounded border-input"
                      />
                      <span className="text-sm">{style}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profileData.studyStyles.map(style => (
                    <Badge key={style} variant="outline">
                      {style}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}