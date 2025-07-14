import React, { useState } from 'react';

// Modern Ticket Card with enhanced UI/UX
const ModernTicketCard = ({ ticket, onActionChange, onQuickAction }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const priorityStyles = {
    Highest: 'border-priority-highest bg-red-50 dark:bg-red-950/20',
    High: 'border-priority-high bg-amber-50 dark:bg-amber-950/20',
    Medium: 'border-priority-medium bg-blue-50 dark:bg-blue-950/20',
    Low: 'border-priority-low bg-emerald-50 dark:bg-emerald-950/20',
    Lowest: 'border-priority-lowest bg-gray-50 dark:bg-gray-950/20',
  };

  const actionStyles = {
    CA: 'bg-action-ca text-white',
    PLAN: 'bg-action-plan text-white',
    DELEGATE: 'bg-action-delegate text-white',
    LATER: 'bg-action-later text-white',
    MONITOR: 'bg-action-monitor text-white',
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border-2 transition-all duration-300
        ${priorityStyles[ticket.priority]}
        ${isHovered ? 'shadow-card-hover scale-[1.02]' : 'shadow-card'}
        ${ticket.client.isException ? 'ring-2 ring-red-500 ring-offset-2' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Exception Badge */}
      {ticket.client.isException && (
        <div className="absolute top-0 right-0 bg-red-600 text-white px-3 py-1 rounded-bl-lg text-xs font-bold animate-pulse-slow">
          EXCEPTION
        </div>
      )}

      {/* Main Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                {ticket.key}
              </span>
              {ticket.client.isCA && (
                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xxs font-medium rounded-full">
                  CA
                </span>
              )}
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xxs rounded-full">
                Tier {ticket.client.tier}
              </span>
            </div>
            <h3 className="text-gray-900 dark:text-gray-100 font-medium line-clamp-2">
              {ticket.summary}
            </h3>
          </div>

          {/* Priority Indicator */}
          <div className={`
            px-3 py-1 rounded-full text-xs font-bold
            ${ticket.priority === 'Highest' ? 'bg-red-500 text-white' : ''}
            ${ticket.priority === 'High' ? 'bg-amber-500 text-white' : ''}
            ${ticket.priority === 'Medium' ? 'bg-blue-500 text-white' : ''}
            ${ticket.priority === 'Low' ? 'bg-emerald-500 text-white' : ''}
            ${ticket.priority === 'Lowest' ? 'bg-gray-500 text-white' : ''}
          `}>
            {ticket.priority}
          </div>
        </div>

        {/* Client & Status Info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">{ticket.client.name}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-600 dark:text-gray-400">{ticket.status}</span>
          </div>
        </div>

        {/* Action Assignment */}
        <div className="flex items-center justify-between">
          {ticket.assignedAction ? (
            <span className={`
              px-3 py-1 rounded-lg text-sm font-medium
              ${actionStyles[ticket.assignedAction]}
            `}>
              {ticket.assignedAction}
            </span>
          ) : (
            <span className="text-sm text-gray-500 italic">No action assigned</span>
          )}

          {/* Quick Actions (visible on hover) */}
          <div className={`
            flex gap-2 transition-opacity duration-200
            ${isHovered ? 'opacity-100' : 'opacity-0'}
          `}>
            <button
              onClick={() => onQuickAction('view', ticket)}
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="View Details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={() => onQuickAction('edit', ticket)}
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expandable Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Created:</span>
                <span className="ml-2 text-gray-700 dark:text-gray-300">2 days ago</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Updated:</span>
                <span className="ml-2 text-gray-700 dark:text-gray-300">5 hours ago</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">SLA:</span>
                <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">4h remaining</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Assignee:</span>
                <span className="ml-2 text-gray-700 dark:text-gray-300">John Doe</span>
              </div>
            </div>
          </div>
        )}

        {/* Expand/Collapse Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      </div>

      {/* Hover Effect Gradient */}
      {isHovered && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none animate-slide-in" />
      )}
    </div>
  );
};

export default ModernTicketCard;