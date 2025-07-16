import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, MapPin, Clock, BookOpen, Globe, Users, Heart, X, ChevronDown, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, off, DataSnapshot } from "firebase/database";

// Firebase configuration - replace with your actual values
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Define interface for study partner data
interface StudyPartner {
  id: string;
  name: string;
  study_field?: string;
  subjects?: string[];
  languages?: string[];
  study_times?: string[];
  study_styles?: string[];
  bio?: string;
  location?: string;
  avatar_url?: string;
  created_at: string;
}

const STUDY_FIELDS = [
  "Computer Science", "Engineering", "Medicine", "Business", "Psychology",
  "Mathematics", "Physics", "Chemistry", "Biology", "Literature", "Other"
];

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese", 
  "Chinese", "Japanese", "Korean", "Arabic", "Russian", "Dutch", "Hebrew", "Lithuanian"
];

const STUDY_TIMES = [
  "Early Morning (6-9 AM)", "Evening (5-8 PM)", "Night (8-11 PM)", "Late Night (11 PM-2 AM)", "Flexible"
];

const STUDY_STYLES = [
  "Visual Learner", "Auditory Learner", "Group Study", "Solo Study", "Discussion-Based", "Practice-Heavy"
];

export default function Discover() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    studyFields: [] as string[],
    languages: [] as string[],
    studyTimes: [] as string[],
    studyStyles: [] as string[],
  });
  const [matches, setMatches] = useState<StudyPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState({
    studyField: true,
    languages: false,
    studyTimes: false,
    studyStyles: false
  });
  
  const isFirstLoad = useRef(true);

  // Firebase setup
  const db = useMemo(() => getDatabase(app), []);

  // Fetch study partners from Firebase Realtime Database
  useEffect(() => {
    const partnersRef = ref(db, 'study_partners');
    
    const handleDataChange = (snapshot: DataSnapshot) => {
      if (!snapshot.exists()) {
        if (isFirstLoad.current) {
          setError("No study partners found. Be the first to create a profile!");
          setLoading(false);
          isFirstLoad.current = false;
        }
        setMatches([]);
        return;
      }
      
      try {
        const data = snapshot.val();
        const partnersArray: StudyPartner[] = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        
        // Sort by created_at descending (newest first)
        partnersArray.sort((a, b) => 
          (b.created_at || '').localeCompare(a.created_at || '')
        );
        
        setMatches(partnersArray);
        
        if (isFirstLoad.current) {
          setLoading(false);
          isFirstLoad.current = false;
        }
      } catch (err) {
        console.error("Error processing data:", err);
        if (isFirstLoad.current) {
          setError("Failed to load study partners. Please try again later.");
          setLoading(false);
          isFirstLoad.current = false;
        }
      }
    };

    const handleError = (error: Error) => {
      console.error("Firebase error:", error);
      if (isFirstLoad.current) {
        setError("Database connection error. Please check your network.");
        setLoading(false);
        isFirstLoad.current = false;
      }
    };

    // Set up real-time listener
    const unsubscribe = onValue(partnersRef, handleDataChange, handleError);
    
    return () => {
      off(partnersRef, 'value', handleDataChange);
    };
  }, [db]);

  const toggleFilter = (category: 'studyFields' | 'languages' | 'studyTimes' | 'studyStyles', value: string) => {
    setFilters(prev => {
      const currentArray = prev[category] as string[];
      return {
        ...prev,
        [category]: currentArray.includes(value)
          ? currentArray.filter(item => item !== value)
          : [...currentArray, value]
      };
    });
  };

  const clearFilters = () => {
    setFilters({
      studyFields: [],
      languages: [],
      studyTimes: [],
      studyStyles: [],
    });
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Filter matches based on search and filters
  const filteredMatches = matches.filter(match => {
    const matchesSearch = match.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (match.subjects && match.subjects.some((subject: string) => 
                           subject.toLowerCase().includes(searchQuery.toLowerCase())));
    
    const matchesStudyField = filters.studyFields.length === 0 || 
                            (match.study_field && filters.studyFields.includes(match.study_field));
    const matchesLanguages = filters.languages.length === 0 || 
                           (match.languages && filters.languages.some(lang => 
                             match.languages.includes(lang)));
    const matchesStudyTimes = filters.studyTimes.length === 0 || 
                            (match.study_times && filters.studyTimes.some(time => 
                              match.study_times.includes(time)));
    const matchesStudyStyles = filters.studyStyles.length === 0 || 
                             (match.study_styles && filters.studyStyles.some(style => 
                               match.study_styles.includes(style)));

    return matchesSearch && matchesStudyField && matchesLanguages && matchesStudyTimes && matchesStudyStyles;
  });

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="flex">
        {/* Filters Sidebar */}
        {showFilters && (
          <div className="w-80 bg-card border-r border-border p-6 space-y-6 overflow-y-auto max-h-screen">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                Filters
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(false)}
                className="md:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={clearFilters}
              className="w-full"
            >
              Clear All Filters
            </Button>

            <Separator />

            {/* Study Field Filter */}
            <Collapsible open={openSections.studyField} onOpenChange={() => toggleSection('studyField')}>
              <CollapsibleTrigger className="flex w-full items-center justify-between p-2 hover:bg-accent-soft rounded">
                <span className="font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Study Field
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${openSections.studyField ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {STUDY_FIELDS.map(field => (
                  <div key={field} className="flex items-center space-x-2">
                    <Checkbox
                      id={`field-${field}`}
                      checked={filters.studyFields.includes(field)}
                      onCheckedChange={() => toggleFilter('studyFields', field)}
                    />
                    <Label htmlFor={`field-${field}`} className="text-sm cursor-pointer">
                      {field}
                    </Label>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Languages Filter */}
            <Collapsible open={openSections.languages} onOpenChange={() => toggleSection('languages')}>
              <CollapsibleTrigger className="flex w-full items-center justify-between p-2 hover:bg-accent-soft rounded">
                <span className="font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  Languages
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${openSections.languages ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2 max-h-48 overflow-y-auto">
                {LANGUAGES.map(language => (
                  <div key={language} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lang-${language}`}
                      checked={filters.languages.includes(language)}
                      onCheckedChange={() => toggleFilter('languages', language)}
                    />
                    <Label htmlFor={`lang-${language}`} className="text-sm cursor-pointer">
                      {language}
                    </Label>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Study Times Filter */}
            <Collapsible open={openSections.studyTimes} onOpenChange={() => toggleSection('studyTimes')}>
              <CollapsibleTrigger className="flex w-full items-center justify-between p-2 hover:bg-accent-soft rounded">
                <span className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Study Times
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${openSections.studyTimes ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {STUDY_TIMES.map(time => (
                  <div key={time} className="flex items-center space-x-2">
                    <Checkbox
                      id={`time-${time}`}
                      checked={filters.studyTimes.includes(time)}
                      onCheckedChange={() => toggleFilter('studyTimes', time)}
                    />
                    <Label htmlFor={`time-${time}`} className="text-sm cursor-pointer">
                      {time}
                    </Label>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Study Styles Filter */}
            <Collapsible open={openSections.studyStyles} onOpenChange={() => toggleSection('studyStyles')}>
              <CollapsibleTrigger className="flex w-full items-center justify-between p-2 hover:bg-accent-soft rounded">
                <span className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Study Styles
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${openSections.studyStyles ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {STUDY_STYLES.map(style => (
                  <div key={style} className="flex items-center space-x-2">
                    <Checkbox
                      id={`style-${style}`}
                      checked={filters.studyStyles.includes(style)}
                      onCheckedChange={() => toggleFilter('studyStyles', style)}
                    />
                    <Label htmlFor={`style-${style}`} className="text-sm cursor-pointer">
                      {style}
                    </Label>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link 
                to="/dashboard" 
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mr-4"
              >
                ← Back to Dashboard
              </Link>
              <Users className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Discover Study Partners</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <Link to="/smart-matching">
                <Button className="gap-2">
                  <Radar className="h-4 w-4" />
                  Smart Matching
                </Button>
              </Link>
              
              {!showFilters && (
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(true)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Show Filters
                </Button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Results Count */}
          <div className="mb-6">
            <p className="text-muted-foreground">
              {loading ? "Loading study partners..." : 
               `Found ${filteredMatches.length} study partner${filteredMatches.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/20 border border-destructive text-destructive p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Match Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="shadow-medium">
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-200 rounded-full h-12 w-12"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                          <div className="h-3 bg-gray-200 rounded w-16"></div>
                        </div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                        <div className="flex gap-1">
                          <div className="h-6 bg-gray-200 rounded w-16"></div>
                          <div className="h-6 bg-gray-200 rounded w-16"></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-4">
                        <div className="h-9 bg-gray-200 rounded flex-1"></div>
                        <div className="h-9 bg-gray-200 rounded w-1/3"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              filteredMatches.map((match) => (
                <Card key={match.id} className="shadow-medium hover:shadow-large transition-all duration-300 hover:scale-[1.01] cursor-pointer">
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          {match.avatar_url ? (
                            <AvatarImage src={match.avatar_url} />
                          ) : (
                            <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                              {match.name?.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-foreground">{match.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {match.location || "No location specified"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <Heart className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Study Field */}
                    <div className="mb-3">
                      <Badge variant="outline" className="text-primary border-primary">
                        {match.study_field || "No field specified"}
                      </Badge>
                    </div>

                    {/* Bio */}
                    <p className="text-sm text-foreground mb-4 line-clamp-2">
                      {match.bio || "No bio available"}
                    </p>

                    {/* Subjects */}
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">SUBJECTS</h4>
                      <div className="flex flex-wrap gap-1">
                        {match.subjects?.slice(0, 3).map((subject: string) => (
                          <Badge key={subject} variant="secondary" className="text-xs">
                            {subject}
                          </Badge>
                        ))}
                        {match.subjects?.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{match.subjects.length - 3} more
                          </Badge>
                        )}
                        {!match.subjects?.length && (
                          <span className="text-xs text-muted-foreground">No subjects listed</span>
                        )}
                      </div>
                    </div>

                    {/* Languages & Study Times */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <h4 className="font-medium text-muted-foreground mb-1">LANGUAGES</h4>
                        <div className="flex flex-wrap gap-1">
                          {match.languages?.slice(0, 2).map((lang: string) => (
                            <span key={lang} className="text-foreground">{lang}</span>
                          ))}
                          {match.languages?.length > 2 && (
                            <span className="text-muted-foreground">+{match.languages.length - 2}</span>
                          )}
                          {!match.languages?.length && (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-muted-foreground mb-1">AVAILABLE</h4>
                        <div className="text-foreground">
                          {match.study_times?.[0]?.split(' ')[0] || 'Flexible'}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                      <Button className="flex-1" size="sm">
                        Connect
                      </Button>
                      <Button variant="outline" size="sm">
                        View Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Empty State */}
          {!loading && filteredMatches.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No matches found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters or search query to find more study partners.
              </p>
              <Button onClick={clearFilters} variant="outline">
                Clear All Filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}