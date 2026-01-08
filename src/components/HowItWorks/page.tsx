export default function HowItWorks() {
  return (
    <div id="how-it-works" className="mb-16 mt-15">
      <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">
        How It Works: Example Output
      </h2>

      <div className="flex flex-col gap-8">
        {/* English Output */}
        <div className="w-[90%] mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-6 h-full sm:flex sm:justify-center sm:items-center">
            <div>
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              English Analysis
            </h3>

            <div className="space-y-6">
              {/* Actions */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <h4 className="font-bold text-lg mb-2">ACTIONS</h4>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Submit final project via online portal</li>
                  <li>Attend mandatory project presentation</li>
                </ul>
              </div>

              {/* Deadlines */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                <h4 className="font-bold text-lg mb-2">DEADLINES</h4>
                <ul className="list-disc ml-5 space-y-1">
                  <li><strong>Today:</strong> Project presentation at 10:00 AM</li>
                  <li><strong>Friday, Nov 24:</strong> Final submission before 5:00 PM</li>
                </ul>
              </div>

              {/* Confusing Parts */}
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-5">
                <h4 className="font-bold text-lg mb-2">CONFUSING PARTS</h4>
                <ul className="list-disc ml-5 space-y-1 text-gray-700">
                  <li>Exact penalties for late submission are not specified</li>
                  <li>Presentation duration and grading criteria are unclear</li>
                </ul>
              </div>

              {/* Urgency */}
              <div className="bg-red-50 border border-red-100 rounded-xl p-5">
                <h4 className="font-bold text-lg mb-2">URGENCY LEVEL</h4>
                <p className="text-red-700 font-semibold">Urgent</p>
              </div>

              {/* Next Step */}
              <div className="bg-green-50 border border-green-100 rounded-xl p-5">
                <h4 className="font-bold text-lg mb-2">NEXT STEP</h4>
                <p className="font-medium">
                  Prepare for tomorrow’s presentation and submit the final project before Friday.
                </p>

                {/* Summary */}
                <div className="mt-4 bg-white border rounded-lg p-4">
                  <h5 className="font-semibold mb-1">SUMMARY</h5>
                  <p className="text-sm text-gray-700">
                    Immediate action is required due to tight deadlines and an upcoming presentation.
                  </p>
              </div>
            </div>
            </div>
          </div>
        </div>
        </div>

        {/* Tagalog Summary Translation */}

        <div className="w-[90%] mx-auto">
                <div className="bg-white rounded-2xl shadow-lg p-6 h-full border-2 border-blue-200 sm:flex sm:justify-center sm:items-center">
                  <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      Translate to any Language
                    </h3>
                    <button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-xs">e.g.</p>
                        Translate to Tagalog
                      </div>
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                     <div className="bg-green-50 border border-green-100 rounded-xl p-5">
                        <h4 className="font-bold text-lg mb-2">BUOD</h4>
                        <p className="text-gray-800">
                            Kinakailangan ang agarang aksyon dahil sa nalalapit na presentasyon at mahigpit na mga deadline.
                        </p>
                        </div>
                    
                  </div>
                  </div>
                </div>
              </div>
      </div>
    </div>
  );
}
