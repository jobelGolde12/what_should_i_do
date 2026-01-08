
export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-800">What Should I Do?</span>
            </div>
            <div className="flex space-x-4">
              <div className="flex gap-3 mt-2">
                <a href="#how-it-works" className="hidden md:inline-block text-gray-600 hover:text-blue-600 font-medium">How it works</a>
              <a href="#features" className="hidden md:inline-block text-gray-600 hover:text-blue-600 font-medium">Features</a>
              </div>
              <a href="#main-input-area" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition">
                Try Now
              </a>
            </div>
          </div>
        </div>
      </header>
  );
}