
import React, { useState } from 'react';
import { getSupabase } from '../services/supabaseClient';
import { useGameStore } from '../store/gameStore';
import { sfx } from '../services/SoundSystem';

interface AuthModalProps {
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    
    const { setUserSession, addLog } = useGameStore();
    const supabase = getSupabase();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase) return;
        
        setLoading(true);
        setErrorMsg('');
        
        try {
            let result;
            if (isLogin) {
                result = await supabase.auth.signInWithPassword({ email, password });
            } else {
                result = await supabase.auth.signUp({ email, password });
            }

            if (result.error) {
                throw result.error;
            }

            if (result.data.session) {
                setUserSession(result.data.session);
                addLog(`Welcome back, ${email.split('@')[0]}!`, "info");
                sfx.playVictory();
                onClose();
            } else if (!isLogin && !result.data.session) {
                // Email confirmation case
                setErrorMsg("Check your email for the confirmation link!");
            }
        } catch (err: any) {
            setErrorMsg(err.message);
            sfx.playUiHover(); // Error sound
        } finally {
            setLoading(false);
        }
    };

    if (!supabase) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 border-2 border-amber-600/50 rounded-xl w-full max-w-sm p-8 shadow-2xl relative overflow-hidden">
                <button onClick={onClose} className="absolute top-2 right-2 text-slate-500 hover:text-white">✕</button>
                
                <h2 className="text-2xl font-serif font-bold text-amber-500 mb-2 text-center">
                    {isLogin ? 'Epic Earth Portal' : 'Join the Guild'}
                </h2>
                <p className="text-slate-400 text-xs text-center mb-6">
                    {isLogin ? 'Sync your progress across dimensions.' : 'Create an account to save your journey.'}
                </p>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:border-amber-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:border-amber-500 outline-none"
                        />
                    </div>

                    {errorMsg && (
                        <div className="text-red-400 text-xs bg-red-900/20 p-2 rounded border border-red-900">
                            {errorMsg}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded shadow-lg transition-all"
                    >
                        {loading ? 'Casting...' : (isLogin ? 'Enter World' : 'Sign Up')}
                    </button>
                </form>

                <div className="mt-4 text-center">
                    <button 
                        onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
                        className="text-xs text-slate-500 hover:text-amber-400 underline"
                    >
                        {isLogin ? "Need an account? Register" : "Already have an account? Login"}
                    </button>
                </div>
            </div>
        </div>
    );
};
