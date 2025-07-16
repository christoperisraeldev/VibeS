import { useState, useEffect } from "react";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { database, auth } from "@/lib/firebaseClient";
import { ref, onValue, update } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom"; // Added useNavigate import
import { ArrowLeft, UserPlus, MessageCircle } from "lucide-react";

// Register ChartJS components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

// Partner interface matching Firebase schema
export interface Partner {
  id: string;
  full_name: string;
  smart_compatibility: number;
  subjects: string[];
  location: string;
  email: string;
  skills: string[];
  avatar_url?: string;
}

interface RadarMatchingProps {
  onPartnerSelect: (partner: Partner) => void;
}

const RadarMatching = ({ onPartnerSelect }: RadarMatchingProps) => {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchPartners = async () => {
      if (!currentUserId) return;
      
      setLoading(true);
      try {
        const usersRef = ref(database, 'profiles');
        
        onValue(usersRef, (snapshot) => {
          const usersData: Partner[] = [];
          const data = snapshot.val();
          
          if (data) {
            for (const userId in data) {
              if (userId !== currentUserId) {
                const userData = data[userId];
                usersData.push({
                  id: userId,
                  full_name: userData.full_name || 'Anonymous',
                  smart_compatibility: userData.smart_compatibility || 0,
                  subjects: userData.subjects || [],
                  location: userData.location || 'Unknown',
                  email: userData.email || 'No email',
                  skills: userData.skills || [],
                  avatar_url: userData.avatar_url || ''
                });
              }
            }
          }
          
          // Sort by compatibility and limit to 10 partners
          const sortedPartners = usersData.sort((a, b) => 
            b.smart_compatibility - a.smart_compatibility
          );
          setPartners(sortedPartners.slice(0, 10));
          setLoading(false);
        });
      } catch (error) {
        toast({
          title: "Fetch Error",
          description: "Failed to load study partners",
          variant: "destructive",
        });
        console.error("Firebase fetch error:", error);
        setLoading(false);
      }
    };

    fetchPartners();
  }, [currentUserId, toast]);

  const handleSelectPartner = (partner: Partner) => {
    setSelectedPartner(partner);
    onPartnerSelect(partner);
  };

  const sendConnectionRequest = async () => {
    if (!currentUserId || !selectedPartner) return;

    try {
      // Create notification object
      const notification = {
        type: "connection",
        title: "New Connection Request",
        message: `You have a new connection request from ${auth.currentUser?.displayName || "a user"}`,
        created_at: new Date().toISOString(),
        read: false,
        actionable: true,
        user_id: selectedPartner.id,
        sender_id: currentUserId
      };

      // Get a new key for the notification
      const notificationsRef = ref(database, 'notifications');
      const newNotificationRef = ref(database, `notifications/${currentUserId}_${Date.now()}`);
      
      // Save the notification
      await update(newNotificationRef, notification);
      
      toast({
        title: "Request Sent!",
        description: `Connection request sent to ${selectedPartner.full_name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send connection request",
        variant: "destructive",
      });
      console.error("Error sending connection request:", error);
    }
  };

  // Prepare radar data
  const radarData = {
    labels: ["Compatibility", "Subjects", "Location", "Skills"],
    datasets: partners.map((partner) => ({
      label: partner.full_name,
      data: [
        partner.smart_compatibility,
        partner.subjects.length * 20,
        partner.location ? 80 : 30,
        partner.skills.length * 15,
      ],
      backgroundColor: `rgba(${
        partner.id === selectedPartner?.id ? "99, 102, 241" : "75, 192, 192"
      }, 0.2)`,
      borderColor: `rgba(${
        partner.id === selectedPartner?.id ? "99, 102, 241" : "75, 192, 192"
      }, 1)`,
      borderWidth: partner.id === selectedPartner?.id ? 3 : 1,
      pointRadius: partner.id === selectedPartner?.id ? 6 : 4,
    })),
  };

  const radarOptions = {
    scales: {
      r: {
        angleLines: { display: true },
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: { stepSize: 20 },
      },
    },
    onClick: (_, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        handleSelectPartner(partners[index]);
      }
    },
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center space-y-4">
        <Skeleton className="w-full h-64 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="w-32 h-10 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-3xl mb-8 p-4 bg-card rounded-xl shadow-lg border border-border">
        {partners.length > 0 ? (
          <Radar data={radarData} options={radarOptions} />
        ) : (
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-muted-foreground text-lg mb-4">No study partners found</p>
            <Button asChild>
              <Link to="/profile">Complete your profile to find matches</Link>
            </Button>
          </div>
        )}
      </div>
      
      {partners.length > 0 && (
        <>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {partners.map((partner) => (
              <Button
                key={partner.id}
                variant={selectedPartner?.id === partner.id ? "default" : "outline"}
                onClick={() => handleSelectPartner(partner)}
                className="min-w-[160px] transition-all"
              >
                <div className="text-center">
                  <p className="font-semibold">{partner.full_name}</p>
                  <p className="text-xs opacity-75">
                    {partner.smart_compatibility}% match
                  </p>
                </div>
              </Button>
            ))}
          </div>

          {selectedPartner && (
            <div className="mt-4 p-6 bg-card rounded-xl shadow-lg border border-border w-full max-w-2xl">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold">Selected Study Partner</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    onClick={sendConnectionRequest}
                    className="gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Connect
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={`/chat?partnerId=${selectedPartner.id}`} className="gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Message
                    </Link>
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 text-primary">Personal Details</h4>
                  <div className="space-y-2">
                    <p><span className="font-medium">Name:</span> {selectedPartner.full_name}</p>
                    <p><span className="font-medium">Location:</span> {selectedPartner.location || "Unknown"}</p>
                    <p><span className="font-medium">Email:</span> {selectedPartner.email}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-primary">Compatibility Factors</h4>
                  <div className="space-y-2">
                    <p><span className="font-medium">Match Score:</span> {selectedPartner.smart_compatibility}%</p>
                    <p><span className="font-medium">Subjects:</span> {selectedPartner.subjects.join(", ") || "None"}</p>
                    <p><span className="font-medium">Skills:</span> {selectedPartner.skills.join(", ") || "None"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const SmartMatching = () => {
  const navigate = useNavigate(); // Properly initialized

  return (
    <div className="min-h-screen bg-gradient-subtle py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-center flex-1">
            Smart Matching
          </h1>
          <div className="w-24"></div> {/* Spacer for alignment */}
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="mb-8 text-center">
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Find your perfect study partner based on compatibility scores, subjects, and skills.
              Click on the radar chart or buttons below to select a partner.
            </p>
          </div>

          <RadarMatching onPartnerSelect={() => {}} />
        </div>
      </div>
    </div>
  );
};

export default SmartMatching;