import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, BookOpen } from "lucide-react";
import libraryBg from "@/assets/library-background.jpg";
import { 
  auth, 
  database,
  type FirebaseUser 
} from "@/lib/firebaseClient";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { ref, set } from "firebase/database";

export const AuthForm = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    university: "",
    username: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        loginForm.email, 
        loginForm.password
      );

      if (!userCredential.user) {
        throw new Error("Authentication failed");
      }

      toast({
        title: "Welcome back!",
        description: "Successfully logged in to VibeS",
      });
      
      navigate("/dashboard");
    } catch (error) {
      let errorMessage = "Please enter valid credentials";
      
      if (error instanceof Error) {
        switch (error.message) {
          case "Firebase: Error (auth/invalid-credential).":
          case "Firebase: Error (auth/wrong-password).":
            errorMessage = "Invalid email or password";
            break;
          case "Firebase: Error (auth/user-not-found).":
            errorMessage = "User not found";
            break;
          case "Firebase: Error (auth/too-many-requests).":
            errorMessage = "Too many attempts. Try again later";
            break;
          default:
            errorMessage = error.message || "Login failed";
        }
      }

      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Validate passwords match
      if (signupForm.password !== signupForm.confirmPassword) {
        throw new Error("Passwords don't match");
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        signupForm.email,
        signupForm.password
      );

      const user = userCredential.user;
      
      if (!user) {
        throw new Error("User authentication failed - no user ID created");
      }

      // Set display name in Firebase Auth
      await updateProfile(user, {
        displayName: signupForm.name
      });

      // Create profile in Firebase Realtime Database
      const profileRef = ref(database, `profiles/${user.uid}`);
      await set(profileRef, {
        email: signupForm.email,
        full_name: signupForm.name,
        university: signupForm.university,
        username: signupForm.username,
        created_at: new Date().toISOString(),
        avatar_url: ""
      });

      toast({
        title: "Account created!",
        description: "Welcome to VibeS - your study journey begins now",
      });
      
      navigate("/onboarding");
    } catch (error) {
      let errorMessage = "Please fill in all required fields";
      
      if (error instanceof Error) {
        switch (error.message) {
          case "Firebase: Error (auth/email-already-in-use).":
            errorMessage = "Email already in use";
            break;
          case "Firebase: Error (auth/weak-password).":
            errorMessage = "Password should be at least 6 characters";
            break;
          case "Firebase: Error (auth/invalid-email).":
            errorMessage = "Invalid email address";
            break;
          default:
            errorMessage = error.message || "Registration failed";
        }
      }

      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive",
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
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-glow">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-inter font-bold text-foreground mb-2">
            Welcome to VibeS
          </h1>
          <p className="text-muted-foreground font-open-sans">
            Find your perfect study partner at university
          </p>
        </div>

        <Card className="bg-card/95 backdrop-blur-sm border-border/50 shadow-large">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                <TabsTrigger 
                  value="login" 
                  className="font-inter font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="font-inter font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="space-y-4">
              <TabsContent value="login" className="space-y-4 mt-0">
                <CardDescription className="font-open-sans text-center">
                  Sign in to your VibeS account
                </CardDescription>
                
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="font-inter font-medium">
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="student@university.edu"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                      className="font-open-sans bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="font-inter font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        className="font-open-sans bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 pr-10"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full font-inter font-medium bg-primary hover:bg-primary-hover text-primary-foreground shadow-soft hover:shadow-medium transition-all duration-300 hover:scale-105"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-0">
                <CardDescription className="font-open-sans text-center">
                  Create your VibeS account to get started
                </CardDescription>
                
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="font-inter font-medium">
                      Full Name
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signupForm.name}
                      onChange={(e) => setSignupForm(prev => ({ ...prev, name: e.target.value }))}
                      className="font-open-sans bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-username" className="font-inter font-medium">
                      Username
                    </Label>
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="Choose a unique username"
                      value={signupForm.username}
                      onChange={(e) => setSignupForm(prev => ({ ...prev, username: e.target.value }))}
                      className="font-open-sans bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="font-inter font-medium">
                      Personal Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="student@university.edu"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                      className="font-open-sans bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-university" className="font-inter font-medium">
                      University
                    </Label>
                    <Input
                      id="signup-university"
                      type="text"
                      placeholder="University of California, Berkeley"
                      value={signupForm.university}
                      onChange={(e) => setSignupForm(prev => ({ ...prev, university: e.target.value }))}
                      className="font-open-sans bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="font-inter font-medium">
                        Password
                      </Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Create password"
                        value={signupForm.password}
                        onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                        className="font-open-sans bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm" className="font-inter font-medium">
                        Confirm Password
                      </Label>
                      <Input
                        id="signup-confirm"
                        type="password"
                        placeholder="Confirm password"
                        value={signupForm.confirmPassword}
                        onChange={(e) => setSignupForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="font-open-sans bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full font-inter font-medium bg-primary hover:bg-primary-hover text-primary-foreground shadow-soft hover:shadow-medium transition-all duration-300 hover:scale-105"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6 font-open-sans">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};