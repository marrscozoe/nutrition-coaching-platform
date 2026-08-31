'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Toast from '@/components/Toast';

interface ClientData {
  id: string;
  name: string;
  gender: string;
  current_phase: number;
  goal_weight: number;
  current_weight: number;
  starting_weight: number;
  program_type: string;
  event_date?: string;
  current_week: number;
  notes?: string;
  is_tester?: boolean;
}

export default function LogMealPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(
    () => new Date().getDay() === 0 ? 6 : new Date().getDay() - 1 // 0=Mon, 6=Sun; JS Sunday=0
  );
  // Store the actual date string directly to avoid computation mismatch
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [foodDescription, setFoodDescription] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [portionAdvice, setPortionAdvice] = useState<string | null>(null);
  const [onPhase, setOnPhase] = useState(true);
  const [messedUp, setMessedUp] = useState(false);
  const [showMessedUpConfirm, setShowMessedUpConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Correction dialog state
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [correctionFoodName, setCorrectionFoodName] = useState('');
  const [correctionCategory, setCorrectionCategory] = useState('protein');
  const [canSeeCorrection, setCanSeeCorrection] = useState(false);
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  useEffect(() => {
    const userData = sessionStorage.getItem('client_user');
    const userType = sessionStorage.getItem('client_user_type');

    if (!userData || userType !== 'client') {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    setClient(user);
    setLoading(false);
    
    // Check if user can see correction button
    checkCorrectionStatus(user.id);
  }, [router]);
  
  async function checkCorrectionStatus(clientId: string) {
    try {
      const res = await fetch('/api/client/correction-status', {
        headers: { 'x-client-id': clientId }
      });
      const data = await res.json();
      if (data.canSeeCorrectionButton) {
        setCanSeeCorrection(true);
      }
    } catch (e) {
      console.error('Error checking correction status:', e);
    }
  }

  // Get the date (YYYY-MM-DD) for a given day index (0=Mon)
  function getDateForDay(dayIndex: number): string {
    const today = new Date();
    const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
    let diff = dayIndex - todayIndex;
    const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Target size: 1.5MB to leave buffer, max 2MB for API
    const TARGET_SIZE = 1.5 * 1024 * 1024; // 1.5MB target
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB hard limit

    // If already under 1.5MB, use directly
    if (file.size <= TARGET_SIZE) {
      convertToBase64(file);
      return;
    }

    // Need to compress - use canvas to resize
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions (max 1200px on longest side)
        const MAX_DIM = 1200;
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        // Try quality 0.8 first, then lower if needed
        compressImage(img, width, height, 0.8, TARGET_SIZE);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function compressImage(img: HTMLImageElement, width: number, height: number, quality: number, targetSize: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to base64
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.split(',')[1];
    
    // Check size
    const sizeBytes = (base64.length * 3) / 4; // Approximate decoded size
    
    if (sizeBytes > targetSize && quality > 0.3) {
      // Try lower quality
      compressImage(img, width, height, quality - 0.1, targetSize);
    } else if (sizeBytes > targetSize) {
      // Try smaller dimensions
      const newWidth = Math.round(width * 0.8);
      const newHeight = Math.round(height * 0.8);
      compressImage(img, newWidth, newHeight, 0.7, targetSize);
    } else {
      // Good size - use it
      setPhotoBase64(base64);
      setPhotoPreview(dataUrl);
    }
  }

  function convertToBase64(file: File) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];
      setPhotoBase64(base64Data);
      setPhotoPreview(base64);
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyze() {
    if (!foodDescription && !photoBase64) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client!.id,
        },
        body: JSON.stringify({
          foodDescription,
          photoBase64,
          mealDate: selectedDate,
          gender: client?.gender,
          currentPhase: client?.current_phase,
          goalWeight: client?.goal_weight,
          currentWeight: client?.current_weight,
          startingWeight: client?.starting_weight,
          programType: client?.program_type,
          eventDate: client?.event_date,
          weekNumber: client?.current_week,
          trainerNotes: client?.notes,
        }),
      });

      const data = await res.json();

      if (data.analysis) {
        setAnalysisResult(data.analysis);
        setPortionAdvice(data.portionAdvice);
        setOnPhase(data.onPhase !== false);
        setMessedUp(data.onPhase === false);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogFood() {
    if (!foodDescription && !photoBase64) {
      setToast({ message: 'Please enter a food description or take a photo', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Call analyze endpoint to get AI coaching advice
      const analyzeRes = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client!.id,
        },
        body: JSON.stringify({
          mealType,
          foodDescription,
          photoBase64,
          mealDate: selectedDate,
          gender: client?.gender,
          currentPhase: client?.current_phase,
          goalWeight: client?.goal_weight,
          currentWeight: client?.current_weight,
          startingWeight: client?.starting_weight,
          programType: client?.program_type,
          eventDate: client?.event_date,
          weekNumber: client?.current_week,
          trainerNotes: client?.notes,
        }),
      });

      let analysisResult = null;
      let portionAdvice = null;
      let onPhase = true;
      let messedUp = false;

      if (analyzeRes.ok) {
        const analyzeData = await analyzeRes.json();
        analysisResult = analyzeData.analysis;
        portionAdvice = analyzeData.portionAdvice;
        onPhase = analyzeData.onPhase !== false;
        messedUp = analyzeData.onPhase === false;
      }

      // Step 2: Save meal to database
      const saveRes = await fetch('/api/meals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client!.id,
        },
        body: JSON.stringify({
          mealType,
          mealDate: selectedDate,
          foodDescription: foodDescription || 'Photo logged',
          photoUrl: photoPreview,
          analyzedText: analysisResult,
          portionAdvice,
          onPhase,
          messedUp,
        }),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        setToast({ message: saveData.error || 'Failed to log meal. Please try again.', type: 'error' });
        setSubmitting(false);
        return;
      }

      // Step 3: Prepare meal data for chat display
      const mealPayload = {
        id: saveData.mealId || `meal_${Date.now()}`,
        mealType,
        mealDate: selectedDate,
        foodDescription: foodDescription || 'Photo logged',
        photoUrl: photoPreview,
        analyzedText: analysisResult,
        portionAdvice,
        onPhase,
        messedUp,
        coachMessage: saveData.coachMessage || null,
      };

      // Store pending meal data in sessionStorage for chat page to display
      sessionStorage.setItem('pending_meal_data', JSON.stringify(mealPayload));

      // Clear form
      setFoodDescription('');
      setPhotoPreview(null);
      setPhotoBase64(null);
      setAnalysisResult(null);
      setPortionAdvice(null);
      setOnPhase(true);
      setMessedUp(false);

      // Show success and redirect to chat
      setToast({ 
        message: messedUp 
          ? "Logged! Get back on track next meal! 💪" 
          : "Great job logging! Keep it up! 👊", 
        type: 'success' 
      });
      
      // Small delay to let toast show before navigation
      setTimeout(() => {
        router.push('/client/chat');
      }, 800);
    } catch (err) {
      console.error('Log food failed:', err);
      setToast({ message: 'Network error. Please check your connection and try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleMessedUpConfirm() {
    setMessedUp(true);
    setShowMessedUpConfirm(false);
  }

  function handleOpenCorrectionDialog() {
    // Pre-fill with the logged food description
    setCorrectionFoodName(foodDescription || '');
    setCorrectionCategory('protein');
    setShowCorrectionDialog(true);
  }

  async function handleSubmitCorrection() {
    console.log('[Correction Debug] submit called, correctionFoodName:', JSON.stringify(correctionFoodName), 'client:', client?.id);
    
    if (!correctionFoodName.trim()) {
      console.log('[Correction Debug] FAIL: correctionFoodName is empty');
      setToast({ message: 'Please enter the food name that was misclassified', type: 'error' });
      return;
    }
    
    if (!client) {
      console.log('[Correction Debug] FAIL: client is null');
      setToast({ message: 'Session error. Please reload the page.', type: 'error' });
      return;
    }
    
    setSubmittingCorrection(true);
    try {
      console.log('[Correction Debug] Sending API request with foodName:', correctionFoodName.trim(), 'category:', correctionCategory);
      const res = await fetch('/api/corrections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client.id,
        },
        body: JSON.stringify({
          foodName: correctionFoodName.trim(),
          correctCategory: correctionCategory,
        }),
      });
      
      console.log('[Correction Debug] Response status:', res.status);
      const data = await res.json();
      console.log('[Correction Debug] Response data:', JSON.stringify(data));
      
      if (data.success) {
        setToast({ message: 'Thanks! AI will learn from this correction. 🙏', type: 'success' });
        setShowCorrectionDialog(false);
        setCorrectionFoodName('');
      } else {
        setToast({ message: data.error || 'Failed to submit correction', type: 'error' });
      }
    } catch (err) {
      console.error('Correction submit failed:', err);
      setToast({ message: 'Failed to submit correction', type: 'error' });
    } finally {
      setSubmittingCorrection(false);
    }
  }

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-orange text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-24 pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <header className="px-6 py-4 pt-[env(safe-area-inset-top)] flex items-center justify-between">
        <Link href="/client" className="text-brand-cream/60 hover:text-brand-cream">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold text-brand-cream">Log Meal</h1>
        <div className="w-12" />
      </header>

      <div className="px-4 space-y-4">
        {/* Meal Type Selector */}
        <div>
          <label className="block text-sm text-brand-cream/60 mb-2">Meal</label>
          <div className="grid grid-cols-4 gap-2">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMealType(type)}
                className={`py-3 px-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  mealType === type
                    ? 'bg-brand-orange text-white'
                    : 'bg-brand-charcoal/80 text-brand-cream/60'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Day Selector */}
        <div>
          <label className="block text-sm text-brand-cream/60 mb-2">Day</label>
          <div className="grid grid-cols-7 gap-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setSelectedDayIndex(index);
                  const d = new Date();
                  const todayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
                  const diff = index - todayIndex;
                  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
                  const y = target.getFullYear();
                  const m = String(target.getMonth() + 1).padStart(2, '0');
                  const day = String(target.getDate()).padStart(2, '0');
                  setSelectedDate(`${y}-${m}-${day}`);
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors ring-1 ${
                  selectedDayIndex === index
                    ? 'bg-brand-orange text-white ring-brand-orange'
                    : 'bg-brand-charcoal/80 text-brand-cream/60 hover:bg-brand-charcoal ring-transparent'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
          <p className="text-xs text-brand-cream/40 mt-1 text-center">
            {selectedDayIndex === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)
              ? 'Today'
              : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][selectedDayIndex]}
            {' — '}
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>

        {/* Food Description */}
        <div>
          <label className="block text-sm text-brand-cream/60 mb-2">
            What did you eat?
          </label>
          <textarea
            value={foodDescription}
            onChange={(e) => setFoodDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange resize-none"
            placeholder="Describe your meal... (e.g., 6oz chicken breast, 1 cup broccoli, 1 tbsp olive oil)"
            rows={3}
          />
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-sm text-brand-cream/60 mb-2">
            Or snap a photo 📸
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoCapture}
            className="hidden"
          />
          
          {photoPreview ? (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Meal preview"
                className="w-full h-48 object-contain rounded-lg bg-black/20"
              />
              <button
                type="button"
                onClick={() => {
                  setPhotoPreview(null);
                  setPhotoBase64(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 rounded-lg border-2 border-dashed border-brand-cream/20 flex flex-col items-center justify-center text-brand-cream/40 hover:border-brand-orange hover:text-brand-orange transition-colors"
            >
              <span className="text-3xl mb-2">📷</span>
              <span className="text-sm">Tap to take photo</span>
            </button>
          )}
        </div>

        {/* Log Food Button - Simplified single step */}
        {(foodDescription || photoBase64) && (
          <button
            type="button"
            onClick={handleLogFood}
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
          >
            {submitting ? 'Logging...' : '🍽️ Log Food'}
          </button>
        )}

        {/* Quick Suggestion */}
        <div className="p-4 rounded-xl bg-brand-charcoal/60 border border-brand-cream/10">
          <p className="text-xs text-brand-cream/50 mb-2">💡 Phase {client.current_phase} tip:</p>
          <p className="text-sm text-brand-cream/80">
            {client.current_phase === 1
              ? 'No starch! Focus on lean protein, fibrous vegetables, and healthy fats.'
              : client.current_phase === 2
              ? 'Add starch on Wed/Sat/Sun to first 2 meals only.'
              : client.current_phase === 4
              ? 'Maintenance mode! Add starch to every meal. If you go 5+ lbs over goal, you will move back to Phase 1.'
              : client.current_phase === 5
              ? 'Rotating 14-day plan! Alternate between strict (no starch) and re-feed (add starch) days. Check your plan for daily details.'
              : client.current_phase === 6
              ? 'Muscle gain phase! Higher carbs and fats. Take whey protein 1st thing Am and last thing Pm and creatine as directed on container. If you hit your goal weight, you will move to maintenance.'
              : 'Keep following your plan and stay consistent!'}
          </p>
        </div>
      </div>

      {/* Correction Dialog */}
      {showCorrectionDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-charcoal rounded-2xl p-6 w-full max-w-md border border-brand-cream/20">
            <h3 className="text-lg font-semibold text-brand-cream mb-4">🤖 Report AI Mistake</h3>
            
            <p className="text-sm text-brand-cream/70 mb-4">
              Which food was the AI wrong about, and what should it actually be classified as?
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-brand-cream/80 mb-2">Food name</label>
                <input
                  type="text"
                  value={correctionFoodName}
                  onChange={(e) => setCorrectionFoodName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                  placeholder="e.g., bacon, grilled chicken"
                />
              </div>
              
              <div>
                <label className="block text-sm text-brand-cream/80 mb-2">What should it be classified as?</label>
                <select
                  value={correctionCategory}
                  onChange={(e) => setCorrectionCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                >
                  <option value="protein">Protein</option>
                  <option value="vegetable">Vegetable</option>
                  <option value="fat">Fat</option>
                  <option value="starch">Starch (Phase 1 violation)</option>
                  <option value="dairy">Dairy (Phase 1 violation)</option>
                  <option value="sugar">Sugar (Phase 1 violation)</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCorrectionDialog(false)}
                  className="flex-1 py-3 rounded-xl bg-brand-charcoal/80 text-brand-cream font-medium hover:bg-brand-charcoal transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitCorrection}
                  disabled={submittingCorrection || !correctionFoodName.trim()}
                  className="flex-1 py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
                >
                  {submittingCorrection ? 'Submitting...' : 'Submit Correction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-brand-charcoal/95 backdrop-blur-sm border-t border-brand-cream/10 safe-bottom">
        <div className="flex justify-around py-3">
          <Link href="/client" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">🏠</span>
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link href="/client/log" className="flex flex-col items-center text-brand-orange">
            <span className="text-xl">📸</span>
            <span className="text-xs mt-1">Log</span>
          </Link>
          <Link href="/client/chat" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">💬</span>
            <span className="text-xs mt-1">Chat</span>
          </Link>
          <Link href="/client/weight" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">⚖️</span>
            <span className="text-xs mt-1">Weight</span>
          </Link>
          <Link href="/client/profile" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">👤</span>
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
