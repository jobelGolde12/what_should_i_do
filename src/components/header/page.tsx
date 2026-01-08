
export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-9 flex items-center justify-center">
                <img src="favicon.ico" alt="Icon" className="rounded-full"/>
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