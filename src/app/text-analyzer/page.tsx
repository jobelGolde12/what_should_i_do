'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';

export default function TextAnalyzerPage() {
  const [inputText, setInputText] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    try {
      // Simulate API call to analyze text
      // In a real application, this would connect to your backend API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay

      // Mock analysis result
      const mockResult = {
        tasks: [
          { id: 1, title: 'Complete project proposal', priority: 'high', deadline: '2024-01-30' },
          { id: 2, title: 'Schedule team meeting', priority: 'medium', deadline: null }
        ],
        deadlines: [
          { id: 1, task: 'Complete project proposal', date: '2024-01-30' }
        ],
        recommendations: [
          'Break down large tasks into smaller, manageable chunks',
          'Set reminders for upcoming deadlines'
        ]
      };

      setAnalysisResult(mockResult);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Analyze Text</h2>
          <p className="text-gray-600 mb-6">
            Paste your text below to extract tasks, deadlines, and get personalized recommendations.
          </p>

          <div className="mb-6">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your text here..."
              className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isLoading || !inputText.trim()}
            className={`px-6 py-3 rounded-lg text-white font-medium ${
              isLoading || !inputText.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Analyzing...' : 'Analyze Text'}
          </button>
        </div>

        {analysisResult && (
          <div className="space-y-6">
            {/* Tasks Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Extracted Tasks</h3>
              <div className="space-y-3">
                {analysisResult.tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <div className="font-medium">{task.title}</div>
                      <div className="text-sm text-gray-500">Priority: {task.priority}</div>
                    </div>
                    {task.deadline && (
                      <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm">
                        Deadline: {task.deadline}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Deadlines Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Deadlines</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Task
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Deadline
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analysisResult.deadlines.map((deadline) => (
                      <tr key={deadline.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {deadline.task}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {deadline.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommendations Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Recommendations</h3>
              <ul className="space-y-2">
                {analysisResult.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}