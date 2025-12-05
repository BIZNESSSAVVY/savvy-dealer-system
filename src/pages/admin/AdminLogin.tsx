// src/pages/admin/AdminLogin.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Lock, Mail, Loader2, Car } from 'lucide-react';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    const { login, currentUser } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Redirect if already logged in
    useEffect(() => {
        if (currentUser) {
            navigate('/admin/inventory', { replace: true });
        }
    }, [currentUser, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!email || !password) {
            toast({
                title: "Missing Information",
                description: "Please enter both email and password.",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);

        try {
            await login(email, password, rememberMe);
            toast({
                title: "Welcome Back! 🚗",
                description: "Login successful. Redirecting to dashboard...",
            });
            navigate('/admin/inventory', { replace: true });
        } catch (error: any) {
            console.error("Login error:", error);
            
            let errorMessage = "Failed to login. Please check your credentials.";
            
            if (error.code === 'auth/user-not-found') {
                errorMessage = "No account found with this email address.";
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = "Incorrect password. Please try again.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Invalid email format.";
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = "Too many failed attempts. Please try again later.";
            } else if (error.code === 'auth/invalid-credential') {
                errorMessage = "Invalid credentials. Please check your email and password.";
            }
            
            toast({
                title: "Login Failed",
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
            <div className="w-full max-w-md">
                {/* Logo & Branding */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <img 
                                src="/src/assets/logo.png" 
                                alt="Cece Auto" 
                                className="h-20 w-auto object-contain"
                                onError={(e) => {
                                    // Fallback to icon if logo fails to load
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.style.display = 'flex';
                                }}
                            />
                            <div 
                                className="h-20 w-20 bg-primary rounded-full items-center justify-center hidden"
                                style={{ display: 'none' }}
                            >
                                <Car className="h-10 w-10 text-white" />
                            </div>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                        Admin Portal
                    </h1>
                    <p className="text-muted-foreground">
                        Sign in to manage your inventory
                    </p>
                </div>

                {/* Login Card */}
                <Card className="shadow-2xl border-0">
                    <CardHeader className="space-y-1 pb-4">
                        <CardTitle className="text-2xl font-bold text-center">
                            Welcome Back
                        </CardTitle>
                        <CardDescription className="text-center">
                            Enter your credentials to access the dashboard
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Email Field */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium">
                                    Email Address
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="admin@ceceauto.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10"
                                        disabled={isLoading}
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium">
                                    Password
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10"
                                        disabled={isLoading}
                                        autoComplete="current-password"
                                    />
                                </div>
                            </div>

                            {/* Remember Me */}
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="remember"
                                    checked={rememberMe}
                                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                                    disabled={isLoading}
                                />
                                <Label
                                    htmlFor="remember"
                                    className="text-sm font-normal cursor-pointer select-none"
                                >
                                    Keep me signed in
                                </Label>
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className="w-full h-11 text-base font-semibold"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>

                        {/* Additional Info */}
                        <div className="mt-6 text-center">
                            <p className="text-xs text-muted-foreground">
                                Protected access for authorized personnel only
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} Cece Auto. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;