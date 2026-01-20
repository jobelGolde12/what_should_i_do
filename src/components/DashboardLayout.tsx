'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Home, FileText, BarChart3, Settings, User, Bell, Menu, X } from 'lucide-react';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'analyze',
    label: 'Analyze Text',
    icon: <FileText size={20} />,
    href: '/dashboard'
  },
  {
    id: 'history',
    label: 'History',
    icon: <BarChart3 size={20} />,
    href: '/dashboard/history'
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: <User size={20} />,
    href: '/dashboard/profile'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings size={20} />,
    href: '/dashboard/settings'
  }
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeItem, setActiveItem] = useState('analyze');

  return (
     <div className="h-screen bg-gray-50 flex overflow-hidden">
       {/* Sidebar */}
       <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transition-transform duration-300 ease-in-out`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 flex items-center justify-center">
                  <Image src="/favicon.ico" alt="Icon" width={32} height={32} className="rounded-full" />
                </div>
                <span className="text-xl font-bold text-gray-800">What Should I Do?</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {sidebarItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  setActiveItem(item.id);
                  setSidebarOpen(false);
                }}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeItem === item.id
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                U
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">User Name</p>
                <p className="text-xs text-gray-500">user@example.com</p>
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Bell size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

       {/* Main Content Area */}
       <div className="flex-1 lg:ml-0 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <div className="w-10"></div>
        </div>

         {/* Desktop Header */}
         <div className="hidden lg:block bg-white shadow-sm p-4 border-b border-gray-200">
           <div className="flex items-center justify-between">
             <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
             <div className="flex items-center space-x-4">
               <button className="p-2 hover:bg-gray-100 rounded-lg">
                 <Bell size={20} />
               </button>
             </div>
           </div>
         </div>

         {/* Main Content with Ads Container */}
         <div className="flex flex-1 overflow-hidden">
           {/* Page Content */}
           <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
             {children}
           </main>

           {/* Ads Container - Desktop Only */}
           <aside className="hidden xl:block w-80 p-6">
             <div className="sticky top-6 space-y-6">
               {/* Ad Space 1 */}
               <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                 <div className="text-center text-gray-500 text-sm font-medium mb-2">Advertisement</div>
                 <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
                   <div className="text-gray-400 text-center">
                     <p className="text-sm">Ad Space 300x250</p>
                     <p className="text-xs mt-1">Google AdSense</p>
                   </div>
                 </div>
               </div>

               {/* Ad Space 2 */}
               <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                 <div className="text-center text-gray-500 text-sm font-medium mb-2">Sponsored</div>
                 <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center">
                   <div className="text-gray-400 text-center">
                     <p className="text-sm">Ad Space 300x200</p>
                     <p className="text-xs mt-1">Custom Ad</p>
                   </div>
                 </div>
               </div>

               {/* Newsletter Signup */}
               <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                 <h3 className="font-medium text-blue-900 mb-2">Stay Updated</h3>
                 <p className="text-sm text-blue-700 mb-3">Get productivity tips and updates</p>
                 <div className="space-y-2">
                   <input
                     type="email"
                     placeholder="Enter your email"
                     className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                   />
                   <button className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                     Subscribe
                   </button>
                 </div>
               </div>
             </div>
           </aside>
         </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}