import { useState } from "react";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="text-xl font-bold text-gray-900">AI.Dev</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => scrollToSection('services')}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200"
            >
              Services
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection('platform')}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200"
            >
              Platform
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200"
            >
              Contact
            </button>
          </nav>

          {/* CTA Button */}
          <div className="hidden md:block">
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              Get Started
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <nav className="px-4 py-4 space-y-3">
              <button
                onClick={() => scrollToSection('services')}
                className="block w-full text-left text-gray-700 hover:text-blue-600 font-medium py-2 transition-colors"
              >
                Services
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="block w-full text-left text-gray-700 hover:text-blue-600 font-medium py-2 transition-colors"
              >
                About
              </button>
              <button
                onClick={() => scrollToSection('platform')}
                className="block w-full text-left text-gray-700 hover:text-blue-600 font-medium py-2 transition-colors"
              >
                Platform
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="block w-full text-left text-gray-700 hover:text-blue-600 font-medium py-2 transition-colors"
              >
                Contact
              </button>
              <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full font-medium mt-4">
                Get Started
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}