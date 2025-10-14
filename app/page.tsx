import Header from "@/components/Header";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <Header />

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white space-y-8">
                <div className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium">
                  WE INTEGRATE DIGITAL PRODUCT
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                  Performance
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                    Marketing Analyst
                  </span>
                </h1>

                <p className="text-lg text-gray-300 max-w-lg">
                  Transform your business with cutting-edge digital solutions. We specialize in AI-driven analytics and performance optimization.
                </p>

                <div className="flex items-center space-x-4">
                  <button className="bg-gradient-primary hover:opacity-90 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105">
                    Get Started
                  </button>
                  <button className="border-2 border-white/30 hover:border-white text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:bg-white/10">
                    Learn More
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="aspect-square bg-gradient-to-br from-cyan-400/20 to-purple-400/20 rounded-full blur-3xl absolute inset-0"></div>
                <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold">Live Performance</span>
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/10 rounded-lg p-4">
                        <div className="text-2xl font-bold text-white">98.5%</div>
                        <div className="text-sm text-gray-300">Accuracy Rate</div>
                      </div>
                      <div className="bg-white/10 rounded-lg p-4">
                        <div className="text-2xl font-bold text-white">24/7</div>
                        <div className="text-sm text-gray-300">Monitoring</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Elements */}
          <div className="absolute top-1/4 left-10 w-20 h-20 bg-cyan-400/20 rounded-full blur-xl animate-float"></div>
          <div className="absolute top-1/3 right-20 w-16 h-16 bg-purple-400/20 rounded-full blur-xl animate-float" style={{animationDelay: '2s'}}></div>
          <div className="absolute bottom-1/4 left-1/4 w-12 h-12 bg-blue-400/20 rounded-full blur-xl animate-float" style={{animationDelay: '4s'}}></div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold text-gradient-primary">125k+</div>
                <div className="text-gray-600 font-medium">Projects Completed Successfully</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold text-gradient-primary">500+</div>
                <div className="text-gray-600 font-medium">Happy Clients Worldwide</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold text-gradient-primary">99.9%</div>
                <div className="text-gray-600 font-medium">Uptime Guarantee</div>
              </div>
            </div>
          </div>
        </section>

        {/* Service Tags */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              {[
                'Branding', 'Market Research', 'Graphic Design', 'Analysis',
                'UI/UX Design', 'Development', 'System Administration', 'AI Integration'
              ].map((tag, index) => (
                <span
                  key={tag}
                  className="px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200 hover:border-primary-300 hover:text-primary-600 transition-colors duration-200 animate-in slide-in-from-bottom-2"
                  style={{animationDelay: `${index * 100}ms`}}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Service Categories */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center mb-12">
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
                {[
                  { id: 'finance', label: 'FINANCE' },
                  { id: 'ml', label: 'MACHINE LEARNING' },
                  { id: 'marketing', label: 'DIGITAL MARKETING' },
                  { id: 'ai', label: 'AI INTEGRATION' }
                ].map((category) => (
                  <button
                    key={category.id}
                    className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      category.id === 'ml'
                        ? 'bg-white text-primary-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Service Cards */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  title: 'AI For Healthcare',
                  description: 'Advanced AI solutions for medical diagnosis and patient care optimization.',
                  icon: '🏥'
                },
                {
                  title: 'AI-Powered Data Analysis',
                  description: 'Transform raw data into actionable insights with machine learning.',
                  icon: '📊'
                },
                {
                  title: 'AI-Powered Chatbots',
                  description: 'Intelligent conversational agents for customer service automation.',
                  icon: '🤖'
                },
                {
                  title: 'AI-Driven Personalization',
                  description: 'Customize user experiences with advanced recommendation systems.',
                  icon: '🎯'
                }
              ].map((service, index) => (
                <div
                  key={service.title}
                  className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100"
                >
                  <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center text-white text-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    {service.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors duration-200">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {service.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
