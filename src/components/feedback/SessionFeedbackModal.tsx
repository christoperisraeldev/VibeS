import { useState } from "react";
import { Star, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { getAuth } from "firebase/auth";
import { database } from "@/lib/firebaseClient";
import { ref, push, set, serverTimestamp } from "firebase/database";

interface SessionFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName: string;
  partnerUserId: string;
  sessionId: string;
  sessionTitle: string;
}

export default function SessionFeedbackModal({ 
  isOpen, 
  onClose, 
  partnerName,
  partnerUserId,
  sessionId,
  sessionTitle 
}: SessionFeedbackModalProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const auth = getAuth();
  
  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please provide a rating before submitting.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Insert feedback into Firebase
      const feedbacksRef = ref(database, 'feedbacks');
      const newFeedbackRef = push(feedbacksRef);
      
      await set(newFeedbackRef, {
        session_id: sessionId,
        rater_user_id: user.uid,
        rated_user_id: partnerUserId,
        rating,
        comment: feedback || null,
        created_at: serverTimestamp()
      });

      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback! This helps improve our matching system.",
      });

      // Reset form
      setRating(0);
      setFeedback("");
      onClose();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Could not submit feedback. Please try again.";
      
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (isSubmitting) return;
    setRating(0);
    setFeedback("");
    onClose();
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => !open && !isSubmitting && onClose()}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">How was your session?</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Partner Info */}
          <div className="flex flex-col items-center space-y-3">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xl">
                {partnerName.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h3 className="font-semibold text-foreground">{sessionTitle}</h3>
              <p className="text-sm text-muted-foreground">with {partnerName}</p>
            </div>
          </div>

          {/* Star Rating */}
          <div className="flex justify-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className="focus:outline-none transition-transform hover:scale-110 disabled:opacity-50"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                disabled={isSubmitting}
              >
                <Star
                  className={`h-8 w-8 ${
                    star <= (hoverRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Rating Labels */}
          <div className="text-center">
            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                {rating === 1 && "Poor - Not helpful"}
                {rating === 2 && "Fair - Somewhat helpful"}
                {rating === 3 && "Good - Moderately helpful"}
                {rating === 4 && "Very Good - Very helpful"}
                {rating === 5 && "Excellent - Extremely helpful"}
              </p>
            )}
          </div>

          {/* Feedback Text */}
          <div>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share your thoughts about the session (optional)..."
              className="min-h-20"
              disabled={isSubmitting}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleSkip} 
              className="flex-1"
              disabled={isSubmitting}
            >
              Skip
            </Button>
            <Button 
              onClick={handleSubmit} 
              className="flex-1 gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                "Submitting..."
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}