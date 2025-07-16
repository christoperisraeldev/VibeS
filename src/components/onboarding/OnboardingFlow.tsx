import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, BookOpen, Globe, GraduationCap } from "lucide-react";
import libraryBg from "@/assets/library-background.jpg";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";

interface OnboardingData {
  studyField: string;
  subjects: string[];
  languages: string[];
  studyStyle: string[];
  bio: string;
}

const STUDY_FIELDS = [
  "Computer Science", "Engineering", "Mathematics", "Physics", "Chemistry", 
  "Biology", "Medicine", "Business", "Economics", "Psychology", "Literature", 
  "History", "Art", "Music", "Law", "Other"
];

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese", 
  "Chinese", "Japanese", "Korean", "Arabic", "Russian", "Dutch", "Hebrew", "Lithuanian", "Other"
];

const STUDY_STYLES = [
  "Solo Focus", "Group Study", "Discussion-Based", "Problem Solving", 
  "Note Taking", "Flash Cards", "Video Learning", "Hands-on Practice"
];

export const OnboardingFlow = ({ userName = "Student" }: { userName?: string }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [customStudyField, setCustomStudyField] = useState("");
  const [formData, setFormData] = useState<OnboardingData>({
    studyField: "",
    subjects: [],
    languages: [],
    studyStyle: [],
    bio: "",
  });

  const db = getDatabase();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        toast({
          title: "Session Expired",
          description: "Please sign in to continue",
          variant: "destructive"
        });
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const totalSteps = 4;

  const handleNext = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const updateFormData = <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: keyof OnboardingData, item: string) => {
    const currentArray = formData[field] as string[];
    const newArray = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    updateFormData(field, newArray);
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1: 
        return formData.studyField.length > 0 || customStudyField.length > 0;
      case 2: return formData.subjects.length > 0;
      case 3: return formData.languages.length > 0;
      case 4: return formData.studyStyle.length > 0;
      default: return false;
    }
  };

  const handleComplete = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to complete onboarding",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const finalStudyField = formData.studyField === "Other" 
        ? customStudyField 
        : formData.studyField;

      // Correct path: users/${user.uid}
      const userProfileRef = ref(db, `users/${user.uid}`);
      
      await set(userProfileRef, {
        studyField: finalStudyField,
        subjects: formData.subjects,
        languages: formData.languages,
        studyStyles: formData.studyStyle,
        bio: formData.bio,
        onboardingComplete: true,
        lastUpdated: Date.now()
      });

      toast({
        title: "Welcome to VibeS! 🎉",
        description: "Your profile has been set up. Let's find your study partners!",
      });
      navigate("/dashboard");
    } catch (error) {
      console.error("Firebase save error:", error);
      let errorMessage = "Could not save your profile. Please try again.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${libraryBg})` }}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-glow">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-inter font-bold text-foreground mb-2">
            Hi {userName}! Let's set up your profile
          </h1>
          <p className="text-muted-foreground font-open-sans">
            Help us find the perfect study partners for you
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-inter font-medium text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-sm font-inter font-medium text-muted-foreground">
              {Math.round((currentStep / totalSteps) * 100)}% complete
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <Card className="bg-card/95 backdrop-blur-sm border-border/50 shadow-large">
          <CardHeader className="pb-4">
            <CardTitle className="font-inter text-xl">
              {currentStep === 1 && "What's your main field of study?"}
              {currentStep === 2 && "What subjects are you currently studying?"}
              {currentStep === 3 && "Language Preferences"}
              {currentStep === 4 && "Study Preferences & Bio"}
            </CardTitle>
            <CardDescription className="font-open-sans">
              {currentStep === 1 && "This helps us connect you with students in similar fields"}
              {currentStep === 2 && "Add the subjects you need help with or can help others"}
              {currentStep === 3 && "Set your language preferences for communication"}
              {currentStep === 4 && "Tell us about your study style and a bit about yourself"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {STUDY_FIELDS.map((field) => (
                    <Button
                      key={field}
                      variant={formData.studyField === field ? "default" : "outline"}
                      className={`p-3 h-auto text-left justify-start font-open-sans ${
                        formData.studyField === field 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-muted"
                      }`}
                      onClick={() => {
                        updateFormData("studyField", field);
                        if (field !== "Other") setCustomStudyField("");
                      }}
                    >
                      <GraduationCap className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="text-sm">{field}</span>
                    </Button>
                  ))}
                </div>
                {formData.studyField === "Other" && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-field" className="font-inter font-medium">
                      Specify your field of study
                    </Label>
                    <Input
                      id="custom-field"
                      placeholder="e.g., Environmental Science"
                      value={customStudyField}
                      onChange={(e) => setCustomStudyField(e.target.value)}
                      className="font-open-sans bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                    />
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subjects-input" className="font-inter font-medium">
                    Add subjects (press Enter after each one)
                  </Label>
                  <Input
                    id="subjects-input"
                    placeholder="e.g., Calculus, Data Structures, Organic Chemistry"
                    className="font-open-sans bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (value && !formData.subjects.includes(value)) {
                          updateFormData("subjects", [...formData.subjects, value]);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                </div>
                {formData.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.subjects.map((subject, index) => (
                      <Badge 
                        key={index}
                        variant="secondary"
                        className="font-open-sans cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => updateFormData("subjects", formData.subjects.filter(s => s !== subject))}
                      >
                        {subject} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-3">
                <Label className="font-inter font-medium flex items-center">
                  <Globe className="w-4 h-4 mr-2" />
                  Languages you're comfortable with
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LANGUAGES.map((language) => (
                    <div key={language} className="flex items-center space-x-2">
                      <Checkbox
                        id={`lang-${language}`}
                        checked={formData.languages.includes(language)}
                        onCheckedChange={() => toggleArrayItem("languages", language)}
                      />
                      <Label 
                        htmlFor={`lang-${language}`} 
                        className="text-sm font-open-sans cursor-pointer"
                      >
                        {language}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="font-inter font-medium">
                    What's your preferred study style?
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STUDY_STYLES.map((style) => (
                      <div key={style} className="flex items-center space-x-2">
                        <Checkbox
                          id={`style-${style}`}
                          checked={formData.studyStyle.includes(style)}
                          onCheckedChange={() => toggleArrayItem("studyStyle", style)}
                        />
                        <Label 
                          htmlFor={`style-${style}`} 
                          className="text-sm font-open-sans cursor-pointer"
                        >
                          {style}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio" className="font-inter font-medium">
                    Tell us a bit about yourself (optional)
                  </Label>
                  <textarea
                    id="bio"
                    placeholder="I'm a second-year CS student who loves problem-solving and collaborative learning. Looking for study partners for algorithms and data structures!"
                    value={formData.bio}
                    onChange={(e) => updateFormData("bio", e.target.value)}
                    className="w-full min-h-[100px] px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm rounded-md border border-input bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 font-open-sans resize-none"
                    maxLength={300}
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    {formData.bio.length}/300
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <div className="flex justify-between items-center p-6 pt-0">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="font-inter font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            {currentStep < totalSteps ? (
              <Button
                onClick={handleNext}
                disabled={!isStepValid()}
                className="font-inter font-medium bg-primary hover:bg-primary-hover text-primary-foreground shadow-soft hover:shadow-medium transition-all duration-300"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={!isStepValid() || isLoading}
                className="font-inter font-medium bg-accent hover:bg-accent/90 text-accent-foreground shadow-soft hover:shadow-medium transition-all duration-300"
              >
                {isLoading ? "Setting up..." : "Complete Setup"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6 font-open-sans">
          You can always update these preferences later in your profile settings
        </p>
      </div>
    </div>
  );
};