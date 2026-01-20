
import DashboardLayout from '@/components/DashboardLayout';

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Your Dashboard</h2>
          <p className="text-gray-600 mb-6">
            Analyze your text and files to extract actionable items, detect deadlines, and get personalized recommendations.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Quick Stats */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-blue-600 text-2xl font-bold mb-2">0</div>
              <div className="text-blue-900 font-medium">Tasks Analyzed</div>
              <div className="text-blue-700 text-sm mt-1">This month</div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-green-600 text-2xl font-bold mb-2">0</div>
              <div className="text-green-900 font-medium">Deadlines Found</div>
              <div className="text-green-700 text-sm mt-1">This month</div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-purple-600 text-2xl font-bold mb-2">0</div>
              <div className="text-purple-900 font-medium">Files Processed</div>
              <div className="text-purple-700 text-sm mt-1">This month</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/dashboard/analyze"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-gray-900">Analyze New Text</div>
                <div className="text-sm text-gray-500">Upload or paste text to analyze</div>
              </div>
            </a>
            
            <a
              href="/dashboard/history"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-gray-900">View History</div>
                <div className="text-sm text-gray-500">See your past analyses</div>
              </div>
            </a>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No recent activity</p>
            <p className="text-sm mt-2">Start analyzing text to see your activity here</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}