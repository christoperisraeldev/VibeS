import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Radar, MapPin, BookOpen, GraduationCap } from "lucide-react";
import { getAuth } from "firebase/auth";
import { database } from "@/lib/firebaseClient";
import { ref, get, query, orderByChild, equalTo } from "firebase/database";

interface UserProfile {
  id: string;
  name: string;
  studyField: string;
  subjects: string[];
  university: string;
  faculty: string;
  location: string;
  city: string;
  country: string;
  yearOfStudy: number;
  avatar?: string;
  position?: { x: number; y: number };
  smartCompatibility?: number;
  subjectMatch?: number;
  institutionMatch?: number;
  locationMatch?: number;
}

interface RadarMatchingProps {
  onPartnerSelect?: (partner: UserProfile) => void;
}

// Collision avoidance algorithm
const adjustPositions = (positions: {x: number, y: number, id: string}[]) => {
  const MARGIN = 10; // Minimum space between points
  const MAX_ITERATIONS = 50;
  
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let hasCollision = false;
    
    for (let j = 0; j < positions.length; j++) {
      for (let k = j + 1; k < positions.length; k++) {
        const dx = positions[j].x - positions[k].x;
        const dy = positions[j].y - positions[k].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < MARGIN) {
          hasCollision = true;
          
          // Calculate repulsion force
          const angle = Math.atan2(dy, dx);
          const force = (MARGIN - distance) / 2;
          
          // Apply repulsion
          positions[j].x += Math.cos(angle) * force;
          positions[j].y += Math.sin(angle) * force;
          positions[k].x -= Math.cos(angle) * force;
          positions[k].y -= Math.sin(angle) * force;
        }
      }
    }
    
    if (!hasCollision) break;
  }
  
  return positions;
};

export default function RadarMatching({ onPartnerSelect }: RadarMatchingProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [matchedPartners, setMatchedPartners] = useState<UserProfile[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const radarContainerRef = useRef<HTMLDivElement>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const auth = getAuth();

  // Fetch current user profile
  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      try {
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          const profile = snapshot.val();
          setCurrentUserProfile({
            id: user.uid,
            ...profile
          });
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchCurrentUserProfile();
  }, [auth]);

  // Fetch potential partners
  const fetchPotentialPartners = async () => {
    if (!currentUserProfile) return [];
    
    try {
      // Get users with the same study field
      const usersRef = ref(database, 'users');
      const usersQuery = query(
        usersRef, 
        orderByChild('studyField'),
        equalTo(currentUserProfile.studyField)
      );
      
      const snapshot = await get(usersQuery);
      if (!snapshot.exists()) return [];
      
      const partners: UserProfile[] = [];
      snapshot.forEach(childSnapshot => {
        const user = childSnapshot.val();
        // Exclude current user
        if (childSnapshot.key !== currentUserProfile.id) {
          partners.push({
            id: childSnapshot.key as string,
            ...user
          });
        }
      });
      
      return partners;
    } catch (error) {
      console.error("Error fetching partners:", error);
      return [];
    }
  };

  const calculateSmartCompatibility = (partner: UserProfile) => {
    if (!currentUserProfile) return { total: 0, subject: 0, institution: 0, location: 0 };
    
    let subjectScore = 0;
    let institutionScore = 0;
    let locationScore = 0;

    // Subject matching (40% weight)
    const commonSubjects = partner.subjects?.filter(subject => 
      currentUserProfile.subjects?.some(userSubject => 
        userSubject.toLowerCase().includes(subject.toLowerCase()) || 
        subject.toLowerCase().includes(userSubject.toLowerCase())
      )
    ) || [];
    
    subjectScore = (commonSubjects.length / Math.max(
      partner.subjects?.length || 1, 
      currentUserProfile.subjects?.length || 1
    )) * 100;

    // Institution matching (30% weight)
    if (partner.university === currentUserProfile.university) {
      institutionScore = 100;
      if (partner.faculty === currentUserProfile.faculty) {
        institutionScore = 100;
      }
    } else {
      institutionScore = 60; // Different university but same field
    }

    // Location matching (20% weight)
    if (partner.city === currentUserProfile.city) {
      locationScore = 100;
    } else if (partner.country === currentUserProfile.country) {
      locationScore = 70;
    } else {
      locationScore = 30;
    }

    // Year of study bonus (10% weight)
    const yearBonus = Math.abs(partner.yearOfStudy - currentUserProfile.yearOfStudy) <= 1 ? 10 : 0;

    const totalScore = (subjectScore * 0.4) + (institutionScore * 0.3) + (locationScore * 0.2) + yearBonus;
    
    return {
      total: Math.round(totalScore),
      subject: Math.round(subjectScore),
      institution: Math.round(institutionScore),
      location: Math.round(locationScore)
    };
  };

  const startRadarScan = async () => {
    if (!currentUserProfile) return;
    
    setIsScanning(true);
    setShowMatches(false);
    setScanProgress(0);

    // Get potential partners from Firebase
    const potentialPartners = await fetchPotentialPartners();
    
    // Simulate radar scanning animation
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          
          // Calculate smart matches
          const smartMatches = potentialPartners.map(partner => {
            const compatibility = calculateSmartCompatibility(partner);
            return {
              ...partner,
              smartCompatibility: compatibility.total,
              subjectMatch: compatibility.subject,
              institutionMatch: compatibility.institution,
              locationMatch: compatibility.location
            };
          })
          .sort((a, b) => (b.smartCompatibility || 0) - (a.smartCompatibility || 0))
          .slice(0, 6); // Top 6 matches

          setMatchedPartners(smartMatches);
          setShowMatches(true);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
  };

  const getCompatibilityRing = (compatibility: number) => {
    if (compatibility >= 90) return 0; // Inner ring - best matches
    if (compatibility >= 80) return 1; // Middle ring - good matches  
    return 2; // Outer ring - decent matches
  };

  const getRingColor = (ring: number) => {
    switch (ring) {
      case 0: return "text-success";
      case 1: return "text-primary"; 
      case 2: return "text-accent";
      default: return "text-muted-foreground";
    }
  };

  // Calculate positions with collision avoidance
  const calculateRadarPositions = () => {
    if (!radarContainerRef.current) return [];
    
    const containerWidth = radarContainerRef.current.clientWidth;
    const containerHeight = radarContainerRef.current.clientHeight;
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    const positions = matchedPartners.map((partner, index) => {
      const ring = getCompatibilityRing(partner.smartCompatibility || 0);
      const radius = ring === 0 ? 0.25 : ring === 1 ? 0.4 : 0.6;
      
      // Start with equidistant positions
      const angle = (index * 360) / matchedPartners.length;
      const radian = (angle * Math.PI) / 180;
      
      return {
        id: partner.id,
        x: centerX + (radius * centerX) * Math.cos(radian),
        y: centerY + (radius * centerY) * Math.sin(radian)
      };
    });
    
    // Apply collision avoidance
    return adjustPositions(positions);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Smart Radar Matching</h2>
        <p className="text-muted-foreground">
          Find your perfect study partner using our intelligent matching algorithm
        </p>
        
        <Button 
          onClick={startRadarScan}
          disabled={isScanning || !currentUserProfile}
          className="gap-2"
          size="lg"
        >
          <Radar className={`h-5 w-5 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning 
            ? `Scanning... ${scanProgress}%` 
            : currentUserProfile 
              ? 'Find a study partner for me' 
              : 'Loading profile...'}
        </Button>
      </div>

      {/* Radar Display */}
      <Card className="mx-auto max-w-2xl overflow-visible">
        <CardContent className="p-8">
          <div 
            ref={radarContainerRef}
            className="relative w-full h-[500px] mx-auto"
          >
            {/* Radar Background */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
              {/* Radar circles */}
              <circle cx="50" cy="50" r="15" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
              <circle cx="50" cy="50" r="25" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
              <circle cx="50" cy="50" r="35" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
              
              {/* Radar lines */}
              <line x1="50" y1="5" x2="50" y2="95" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
              <line x1="5" y1="50" x2="95" y2="50" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
              
              {/* Scanning effect */}
              {isScanning && (
                <line 
                  x1="50" 
                  y1="50" 
                  x2="50" 
                  y2="5" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth="1" 
                  opacity="0.8"
                  transform={`rotate(${scanProgress * 3.6} 50 50)`}
                  className="transition-transform duration-100"
                />
              )}
            </svg>

            {/* Center User */}
            {currentUserProfile && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="relative">
                  <Avatar className="h-14 w-14 border-4 border-primary shadow-lg">
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-center">
                    You
                  </div>
                </div>
              </div>
            )}

            {/* Matched Partners */}
            {showMatches && calculateRadarPositions().map((position) => {
              const partner = matchedPartners.find(p => p.id === position.id);
              if (!partner) return null;
              
              const ring = getCompatibilityRing(partner.smartCompatibility || 0);
              
              return (
                <div
                  key={partner.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 animate-fade-in cursor-pointer group"
                  style={{ left: `${position.x}px`, top: `${position.y}px` }}
                  onClick={() => onPartnerSelect?.(partner)}
                >
                  <div className="relative flex flex-col items-center">
                    <Avatar className={`h-10 w-10 border-2 border-primary/20 shadow-md group-hover:border-primary transition-all group-hover:scale-110`}>
                      <AvatarImage src={partner.avatar} />
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                        {partner.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Compatibility Badge */}
                    <div className={`absolute -top-1 -right-1 text-xs font-bold ${getRingColor(ring)}`}>
                      {partner.smartCompatibility}%
                    </div>
                    
                    {/* Name Label */}
                    <div className="absolute top-full mt-1 text-xs font-medium whitespace-nowrap max-w-[4rem] truncate">
                      {partner.name.split(' ')[0]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          {showMatches && (
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success"></div>
                <span>90%+ Match</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span>80-89% Match</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-accent"></div>
                <span>70-79% Match</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match Results */}
      {showMatches && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Top Matches Found</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {matchedPartners.slice(0, 4).map((partner) => (
              <Card key={partner.id} className="shadow-medium hover:shadow-large transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={partner.avatar} />
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                        {partner.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground">{partner.name}</h4>
                        <Badge variant="default" className="bg-gradient-primary">
                          {partner.smartCompatibility}% Match
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <GraduationCap className="h-3 w-3" />
                          <span>{partner.university} - {partner.faculty}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{partner.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <BookOpen className="h-3 w-3" />
                          <span>Year {partner.yearOfStudy} • {partner.studyField}</span>
                        </div>
                      </div>
                      
                      {/* Compatibility Breakdown */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                        <div className="text-center">
                          <div className="text-xs font-medium text-success">{partner.subjectMatch}%</div>
                          <div className="text-xs text-muted-foreground">Subject</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-medium text-primary">{partner.institutionMatch}%</div>
                          <div className="text-xs text-muted-foreground">University</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-medium text-accent">{partner.locationMatch}%</div>
                          <div className="text-xs text-muted-foreground">Location</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}