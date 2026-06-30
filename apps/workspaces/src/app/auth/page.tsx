'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Loader2, Truck, Package, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth, UserRole } from '@/context/AuthContext';

type FormMode = 'login' | 'signup' | 'forgot';

export default function AuthPage() {
  const { login, signup, user, isLoading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<FormMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Signup extra fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  // Multi-role: user can be both Carrier and Shipper
  const [isCarrier, setIsCarrier] = useState(true);
  const [isShipper, setIsShipper] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyVat, setCompanyVat] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyCountry, setCompanyCountry] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!acceptedTerms) { setError('Please accept the terms of service to continue.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      // Primary role: carrier if checked, else shipper
      const primaryRole: UserRole = isCarrier ? 'carrier' : 'shipper';
      await signup({
        email, password, first_name: firstName, last_name: lastName, role: primaryRole, phone,
        company_name: companyName, company_vat: companyVat,
        company_address: companyAddress, company_city: companyCity, company_country: companyCountry,
      });
      setSuccess('Account created! Please check your email to verify your account.');
      setTimeout(() => setMode('login'), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSuccess('If that email is registered, you will receive a reset link shortly.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-[calc(100vh-72px)] flex">

      {/* Left Panel — Branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div>
          <Image
            src="/logo.png"
            alt="VECTRA Logo"
            width={160}
            height={48}
            className="h-10 w-auto object-contain brightness-0 invert"
            priority
          />
          <p className="text-primary-100 mt-2 text-sm font-medium">Intelligent Freight Marketplace</p>
        </div>

        <div className="space-y-6 z-10">
          <h2 className="text-4xl font-extrabold text-white leading-tight">
            Move freight smarter.<br />Fill every truck.
          </h2>
          <p className="text-primary-100 text-base leading-relaxed max-w-xs">
            Join thousands of carriers and shippers using AI-powered route matching to reduce empty runs and maximize revenue.
          </p>
          <div className="flex gap-8 mt-8">
            <div>
              <div className="text-3xl font-black text-white">94%</div>
              <div className="text-primary-200 text-xs mt-1">Truck utilization</div>
            </div>
            <div>
              <div className="text-3xl font-black text-white">2.3k+</div>
              <div className="text-primary-200 text-xs mt-1">Active routes</div>
            </div>
            <div>
              <div className="text-3xl font-black text-white">€1.2M</div>
              <div className="text-primary-200 text-xs mt-1">Revenue saved</div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 z-10">
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-3">
            <Truck className="text-white h-5 w-5" />
            <span className="text-white text-sm font-medium">Carriers</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-3">
            <Package className="text-white h-5 w-5" />
            <span className="text-white text-sm font-medium">Shippers</span>
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-gray-50 dark:bg-slate-900">
        <div className="w-full max-w-md">

          {/* Mode Tabs */}
          {mode !== 'forgot' && (
            <div className="flex bg-gray-200 dark:bg-slate-800 rounded-xl p-1 mb-8">
              {(['login', 'signup'] as FormMode[]).map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition-all ${mode === m
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {mode === 'login' ? 'Sign in to your VECTRA account'
                : mode === 'signup' ? 'Start moving freight smarter today'
                : 'Enter your email and we\'ll send a reset link'}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl p-4 mb-6 text-sm">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-xl p-4 mb-6 text-sm">
              <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                <input id="login-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" className="saas-input" />
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                  <button type="button" onClick={() => setMode('forgot')}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input id="login-password" type={showPassword ? 'text' : 'password'} required
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" className="saas-input pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
              </label>
              <button id="login-submit" type="submit" disabled={loading} className="saas-button relative">
                {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Sign In'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-slate-700" /></div>
                <div className="relative flex justify-center text-xs uppercase text-gray-400 dark:text-gray-500">
                  <span className="bg-gray-50 dark:bg-slate-900 px-2">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'Google', icon: 'G' },
                  { name: 'Microsoft', icon: 'M' },
                  { name: 'LinkedIn', icon: 'in' },
                ].map(p => (
                  <button key={p.name} type="button"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                    <span className="font-bold text-primary-600">{p.icon}</span>
                  </button>
                ))}
              </div>
            </form>
          )}

          {/* SIGNUP FORM */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-5">
              {/* Role selector — multi-select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kdo sem / What I am</label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Izberete lahko obe vlogi — prevoznik in pošiljatelj.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => { if (!isCarrier && !isShipper) return; setIsCarrier(!isCarrier); }}
                    className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      isCarrier ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-slate-600 hover:border-primary-300'}` }>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isCarrier ? 'bg-primary-500 border-primary-500' : 'border-gray-400 dark:border-slate-500'}`}>
                        {isCarrier && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">Carrier</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">Prevažam blago / tovor</div>
                  </button>
                  <button type="button" onClick={() => { if (!isCarrier && !isShipper) return; setIsShipper(!isShipper); }}
                    className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      isShipper ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-slate-600 hover:border-blue-300'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isShipper ? 'bg-blue-500 border-blue-500' : 'border-gray-400 dark:border-slate-500'}`}>
                        {isShipper && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">Shipper</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">Pošiljam blago / tovor</div>
                  </button>
                </div>
                {isCarrier && isShipper && (
                  <p className="text-xs text-primary-600 dark:text-primary-400 mt-2 font-medium">✓ Registrirani boste kot Carrier + Shipper</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">First name</label>
                  <input id="signup-first-name" type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Bojan" className="saas-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Last name</label>
                  <input id="signup-last-name" type="text" required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Novak" className="saas-input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                <input id="signup-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="saas-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone (optional)</label>
                <input id="signup-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+386 41 123 456" className="saas-input" />
              </div>

              <div className="border-t border-gray-200 dark:border-slate-700 pt-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Company Details</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Company name</label>
                    <input id="signup-company-name" type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="ACME Logistics d.o.o." className="saas-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">VAT / Tax number</label>
                    <input id="signup-vat" type="text" value={companyVat} onChange={e => setCompanyVat(e.target.value)} placeholder="SI12345678" className="saas-input" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">City</label>
                      <input id="signup-city" type="text" value={companyCity} onChange={e => setCompanyCity(e.target.value)} placeholder="Ljubljana" className="saas-input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Country</label>
                      <input id="signup-country" type="text" value={companyCountry} onChange={e => setCompanyCountry(e.target.value)} placeholder="Slovenia" className="saas-input" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                <div className="relative">
                  <input id="signup-password" type={showPassword ? 'text' : 'password'} required
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 characters" className="saas-input pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 flex gap-1">
                    {[8, 12, 16].map((len, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${password.length >= len
                        ? i === 0 ? 'bg-red-400' : i === 1 ? 'bg-yellow-400' : 'bg-green-500'
                        : 'bg-gray-200 dark:bg-slate-700'}`} />
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  I agree to the{' '}
                  <Link href="#" className="text-primary-600 dark:text-primary-400 hover:underline">Terms of Service</Link>{' '}
                  and{' '}
                  <Link href="#" className="text-primary-600 dark:text-primary-400 hover:underline">Privacy Policy</Link>
                </span>
              </label>

              <button id="signup-submit" type="submit" disabled={loading} className="saas-button">
                {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Create Account'}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email address</label>
                <input id="forgot-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" className="saas-input" />
              </div>
              <button id="forgot-submit" type="submit" disabled={loading} className="saas-button">
                {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="w-full text-center text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition">
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
