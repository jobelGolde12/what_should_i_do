import MainInputArea from "../main-input-area/page";
import HowItWorks from "../HowItWorks/page";
import { Zap, Calendar, AlertTriangle, Highlighter, Lightbulb, Languages, GraduationCap, Briefcase, Users, FileText, ArrowRight, Play, ShieldCheck, Check } from "lucide-react";

export default function heroSection() {
  return (
       <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Turn confusing messages into <span className="text-blue-600">clear actions</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              A universal instruction translator that extracts actions, deadlines, and urgency from any text.
              Not a summarizer. Not a chatbot. A decision & action clarity tool.
            </p>
            
            {/* CTA Button */}
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-12">
                <a href="#main-input-area" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg px-8 py-4 rounded-xl pulse-animation transition flex items-center justify-center gap-3">
                  <Zap className="w-6 h-6" />
                  Analyze Your Text Now
                </a>
              </div>
            
            {/* User Flow Visualization */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-10">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Simple 3-Step Process</h3>
              <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="flex flex-col items-center text-center mb-6 md:mb-0">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <h4 className="font-medium text-gray-800">1. Paste Text</h4>
                  <p className="text-gray-600 text-sm">Email, announcement, memo, notice</p>
                </div>
                <ArrowRight className="w-6 h-6 text-gray-400 mb-6 md:mb-0 hidden md:block" />
                <div className="flex flex-col items-center text-center mb-6 md:mb-0">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
                    <Lightbulb className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="font-medium text-gray-800">2. Get Analysis</h4>
                  <p className="text-gray-600 text-sm">Actions, deadlines, urgency, next step</p>
                </div>
                <ArrowRight className="w-6 h-6 text-gray-400 mb-6 md:mb-0 hidden md:block" />
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                    <Languages className="w-8 h-8 text-purple-600" />
                  </div>
                  <h4 className="font-medium text-gray-800">3. Translate to any Language</h4>
                  <p className="text-gray-600 text-sm">One-click translation to any language</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Input Area */}
          <MainInputArea />
          
          {/* Example Output Section */}
          <HowItWorks />
          
          {/* Features Section */}
          <div id="features" className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">Unique Features</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
               <div className="bg-white rounded-2xl shadow-lg p-6 action-card sm:flex sm:justify-center sm:items-center">
                 <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center mb-4 sm:mb-0 sm:mr-4">
                  <Zap className="w-8 h-8 text-blue-600" />
                </div>
                 <div>
                   <h3 className="text-xl font-bold text-gray-800 mb-3">Action Extractor</h3>
                   <p className="text-gray-600">Detects verbs like submit, attend, pay, respond and turns them into clear action items.</p>
                 </div>
               </div>
              
              {/* Feature 2 */}
               <div className="bg-white rounded-2xl shadow-lg p-6 action-card sm:flex sm:justify-center sm:items-center">
                 <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center mb-4 sm:mb-0 sm:mr-4">
                  <Calendar className="w-8 h-8 text-green-600" />
                </div>
                 <div>
                   <h3 className="text-xl font-bold text-gray-800 mb-3">Deadline Detector</h3>
                   <p className="text-gray-600">Converts &quot;by end of week&quot; → actual date with clear visual indicators.</p>
                 </div>
               </div>
              
              {/* Feature 3 */}
               <div className="bg-white rounded-2xl shadow-lg p-6 action-card sm:flex sm:justify-center sm:items-center">
                 <div className="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4 sm:mb-0 sm:mr-4">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                 <div>
                   <h3 className="text-xl font-bold text-gray-800 mb-3">Urgency Classifier</h3>
                   <p className="text-gray-600">Visual color indicators (green/yellow/red) to show how urgent an action is.</p>
                 </div>
               </div>
              
              {/* Feature 4 */}
               <div className="bg-white rounded-2xl shadow-lg p-6 action-card sm:flex sm:justify-center sm:items-center">
                 <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center mb-4 sm:mb-0 sm:mr-4">
                  <Highlighter className="w-8 h-8 text-purple-600" />
                </div>
                 <div>
                   <h3 className="text-xl font-bold text-gray-800 mb-3">Confusion Highlighter</h3>
                   <p className="text-gray-600">Marks sentences that cause misunderstanding and explains them in simple words.</p>
                 </div>
               </div>
              
              {/* Feature 5 */}
               <div className="bg-white rounded-2xl shadow-lg p-6 action-card sm:flex sm:justify-center sm:items-center">
                 <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center mb-4 sm:mb-0 sm:mr-4">
                  <Lightbulb className="w-8 h-8 text-amber-600" />
                </div>
                 <div>
                   <h3 className="text-xl font-bold text-gray-800 mb-3">One-Sentence Guidance</h3>
                   <p className="text-gray-600">&quot;If you do only one thing, do this.&quot; Clear next step recommendation.</p>
                 </div>
               </div>
              
              {/* Feature 6 */}
               <div className="bg-white rounded-2xl shadow-lg p-6 action-card sm:flex sm:justify-center sm:items-center">
                 <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center mb-4 sm:mb-0 sm:mr-4">
                  <Languages className="w-8 h-8 text-indigo-600" />
                </div>
                 <div>
                   <h3 className="text-xl font-bold text-gray-800 mb-3">Tagalog Translation</h3>
                   <p className="text-gray-600">One-click translation of the analyzed results into Tagalog for Filipino users.</p>
                 </div>
               </div>
            </div>
          </div>
          
          {/* User Types Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">Who Uses This Tool</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Student Card */}
               <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-lg p-6 border border-blue-100">
                 <div className="flex items-center gap-4 mb-4">
                   <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                     <GraduationCap className="w-8 h-8 text-blue-600" />
                   </div>
                   <h3 className="text-xl font-bold text-gray-800">Students</h3>
                 </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                   <Check className="w-5 h-5 text-blue-500" />
                    <span>School announcements</span>
                  </li>
                  <li className="flex items-center gap-2">
                   <Check className="w-5 h-5 text-blue-500" />
                    <span>Thesis instructions</span>
                  </li>
                  <li className="flex items-center gap-2">
                   <Check className="w-5 h-5 text-blue-500" />
                    <span>Group project messages</span>
                  </li>
                </ul>
              </div>
              
              {/* Worker Card */}
               <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl shadow-lg p-6 border border-green-100">
                 <div className="flex items-center gap-4 mb-4">
                   <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                     <Briefcase className="w-8 h-8 text-green-600" />
                   </div>
                   <h3 className="text-xl font-bold text-gray-800">Workers</h3>
                 </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                     <Check className="w-5 h-5 text-green-500" />
                    <span>Manager emails</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <Check className="w-5 h-5 text-green-500" />
                    <span>HR notices</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <Check className="w-5 h-5 text-green-500" />
                    <span>Meeting invites</span>
                  </li>
                </ul>
              </div>
              
              {/* Everyday People Card */}
               <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl shadow-lg p-6 border border-purple-100">
                 <div className="flex items-center gap-4 mb-4">
                   <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                     <Users className="w-8 h-8 text-purple-600" />
                   </div>
                   <h3 className="text-xl font-bold text-gray-800">Everyday People</h3>
                 </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                     <Check className="w-5 h-5 text-purple-500" />
                    <span>Bills & government letters</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <Check className="w-5 h-5 text-purple-500" />
                    <span>Barangay notices</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <Check className="w-5 h-5 text-purple-500" />
                    <span>Long Facebook messages</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Final CTA */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 md:p-10 text-center text-white mb-10">
            <h2 className="text-3xl font-bold mb-4">Stop guessing what to do next</h2>
            <p className="text-xl mb-8 opacity-90">Get clear actions from any confusing message in seconds</p>
             <a
             href="#main-input-area"
             className="
               bg-white
               w-full sm:w-auto lg:w-[30%]
               text-center
               text-blue-600
               hover:bg-gray-100
               font-bold
               text-base sm:text-lg
               px-6 sm:px-10
               py-3 sm:py-4
               rounded-xl
               transition
               flex items-center justify-center gap-3
               mx-auto
             "
           >
             <Play className="w-5 h-5 sm:w-6 sm:h-6" />
             Start Analyzing Now
           </a>

             <p className="mt-6 opacity-80 flex items-center justify-center gap-2">
               <ShieldCheck className="w-5 h-5" />
               No login required • Privacy-friendly • Works on mobile
             </p>
          </div>
        </div>
      </main>
  );
};