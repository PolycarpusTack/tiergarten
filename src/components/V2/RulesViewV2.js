import React, { useState } from "react";
import RuleEditModalV2 from "./RuleEditModalV2";
import TimeRuleEditModalV2 from "./TimeRuleEditModalV2";

const RulesViewV2 = ({ rules, api, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [editingTimeRule, setEditingTimeRule] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(["ca", "non-ca"]);
  const [activeTab, setActiveTab] = useState("global-rules");
  const [cardConfig, setCardConfig] = useState({
    displayFields: [
      "key",
      "summary",
      "client",
      "tier",
      "action",
      "priority",
      "status",
      "age",
    ],
    timeSensitivity: {
      enabled: true,
      rules: [],
    },
  });

  const handleAddRule = () => {
    setEditingRule(null);
    setShowModal(true);
  };

  const handleEditRule = (rule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleDeleteRule = async (ruleId) => {
    if (window.confirm("Are you sure you want to delete this rule?")) {
      await api.deleteGlobalRule(ruleId);
      onRefresh();
    }
  };

  const handleSaveRule = async () => {
    setShowModal(false);
    onRefresh();
  };

  const handleSaveCardConfig = async () => {
    try {
      // Save card configuration to backend
      // For now, we'll just show a success message
      console.log("Saving card config:", cardConfig);
      alert("Card configuration saved successfully!");
    } catch (error) {
      console.error("Failed to save card configuration:", error);
      alert("Failed to save configuration. Please try again.");
    }
  };

  const formatRuleCondition = (condition) => {
    const parts = [];
    if (condition.action) parts.push(`Action: ${condition.action}`);
    if (condition.tier) parts.push(`Tier: ${condition.tier}`);
    if (condition.mgxPriority)
      parts.push(`MGX Priority: ${condition.mgxPriority}`);
    if (condition.customerPriority)
      parts.push(`Customer Priority: ${condition.customerPriority}`);
    return parts.length > 0 ? parts.join(", ") : "All Tickets";
  };

  const toggleGroup = (group) => {
    setExpandedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  // Group rules by CA/Non-CA
  const caRules = rules.filter((r) => r.isCA);
  const nonCaRules = rules.filter((r) => !r.isCA);

  const actionColors = {
    CA: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    PLAN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    DELEGATE:
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    LATER:
      "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
    MONITOR:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  };

  const RuleCard = ({ rule }) => (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                actionColors[rule.action]
              }`}
            >
              {rule.action}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            {rule.tier && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">Tier:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {rule.tier}
                </span>
              </div>
            )}
            {rule.mgxPriority && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">
                  MGX Priority:
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {rule.mgxPriority}
                </span>
              </div>
            )}
            {rule.customerPriority && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">
                  Customer Priority:
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {rule.customerPriority}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => handleEditRule(rule)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Edit rule"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={() => handleDeleteRule(rule.id)}
            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete rule"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Rules & Configuration
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure automatic rules and ticket card display settings
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab("global-rules")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "global-rules"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          }`}
        >
          Global Rules
        </button>
        <button
          onClick={() => setActiveTab("card-config")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "card-config"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          }`}
        >
          Card Configuration
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "global-rules" ? (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={handleAddRule}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Rule
            </button>
          </div>

          {/* Rules Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Rules
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {rules.length}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                CA Rules
              </p>
              <p className="text-2xl font-bold text-purple-600">
                {caRules.length}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Non-CA Rules
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {nonCaRules.length}
              </p>
            </div>
          </div>

          {/* Rules by Type */}
          <div className="space-y-6">
            {/* CA Rules */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleGroup("ca")}
                className="w-full p-4 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800 flex items-center justify-between hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                <div>
                  <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                    CA Client Rules
                  </h3>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    {caRules.length} rule{caRules.length !== 1 ? "s" : ""} for
                    Customer Advocate clients
                  </p>
                </div>
                <svg
                  className={`w-5 h-5 text-purple-600 transform transition-transform ${
                    expandedGroups.includes("ca") ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {expandedGroups.includes("ca") && (
                <div className="p-4">
                  {caRules.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      No CA rules configured
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {caRules.map((rule) => (
                        <RuleCard key={rule.id} rule={rule} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Non-CA Rules */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleGroup("non-ca")}
                className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    Non-CA Client Rules
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {nonCaRules.length} rule{nonCaRules.length !== 1 ? "s" : ""}{" "}
                    for standard clients
                  </p>
                </div>
                <svg
                  className={`w-5 h-5 text-blue-600 transform transition-transform ${
                    expandedGroups.includes("non-ca") ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {expandedGroups.includes("non-ca") && (
                <div className="p-4">
                  {nonCaRules.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      No non-CA rules configured
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {nonCaRules.map((rule) => (
                        <RuleCard key={rule.id} rule={rule} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Rule Information */}
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Rules are evaluated in order. The first matching rule
                  determines the ticket's action assignment. Exception clients
                  always receive Tier 1 treatment regardless of configured
                  rules.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Card Configuration Tab Content */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Ticket Card Display Settings
              </h3>

              {/* Display Fields Section */}
              <div className="mb-8">
                <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
                  Display Fields
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Select which fields to show on ticket cards
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: "key", label: "Ticket Key", mandatory: true },
                    { id: "summary", label: "Summary", mandatory: true },
                    { id: "client", label: "Client", mandatory: true },
                    { id: "tier", label: "Tier", mandatory: true },
                    { id: "action", label: "Action", mandatory: true },
                    { id: "priority", label: "Priority" },
                    { id: "status", label: "Status" },
                    { id: "age", label: "Age" },
                    { id: "assignee", label: "Assignee" },
                    { id: "created", label: "Created Date" },
                    { id: "updated", label: "Updated Date" },
                    { id: "duedate", label: "Due Date" },
                    { id: "mgxPriority", label: "MGX Priority" },
                    { id: "customerPriority", label: "Customer Priority" },
                  ].map((field) => (
                    <label
                      key={field.id}
                      className={`flex items-center gap-2 p-3 rounded-lg border ${
                        cardConfig.displayFields.includes(field.id)
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      } ${
                        field.mandatory
                          ? "cursor-not-allowed opacity-75"
                          : "cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={cardConfig.displayFields.includes(field.id)}
                        onChange={() => {
                          if (!field.mandatory) {
                            setCardConfig((prev) => ({
                              ...prev,
                              displayFields: prev.displayFields.includes(
                                field.id
                              )
                                ? prev.displayFields.filter(
                                    (f) => f !== field.id
                                  )
                                : [...prev.displayFields, field.id],
                            }));
                          }
                        }}
                        disabled={field.mandatory}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {field.label}
                      </span>
                      {field.mandatory && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          (Required)
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Time Sensitivity Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">
                      Time Sensitivity Indicators
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Show emoji and badge indicators based on ticket age
                    </p>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cardConfig.timeSensitivity.enabled}
                      onChange={(e) =>
                        setCardConfig((prev) => ({
                          ...prev,
                          timeSensitivity: {
                            ...prev.timeSensitivity,
                            enabled: e.target.checked,
                          },
                        }))
                      }
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable
                    </span>
                  </label>
                </div>

                {cardConfig.timeSensitivity.enabled && (
                  <>
                    <div className="mb-4">
                      <button
                        onClick={() => {
                          setEditingTimeRule({
                            condition: {},
                            thresholds: {
                              warning: 7,
                              critical: 14,
                              overdue: 30,
                            },
                            indicators: {
                              warning: "⚠️",
                              critical: "🔥",
                              overdue: "💀",
                            },
                          });
                          setShowTimeModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        Add Time Rule
                      </button>
                    </div>

                    {/* Time Sensitivity Rules List */}
                    <div className="space-y-3">
                      {cardConfig.timeSensitivity.rules.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          No time sensitivity rules configured. Add a rule to
                          get started.
                        </div>
                      ) : (
                        cardConfig.timeSensitivity.rules.map((rule, index) => (
                          <div
                            key={index}
                            className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {formatRuleCondition(rule.condition)}
                                </div>
                                <div className="mt-2 flex items-center gap-4 text-sm">
                                  <span className="text-yellow-600 dark:text-yellow-400">
                                    {rule.indicators.warning} Warning:{" "}
                                    {rule.thresholds.warning}d
                                  </span>
                                  <span className="text-orange-600 dark:text-orange-400">
                                    {rule.indicators.critical} Critical:{" "}
                                    {rule.thresholds.critical}d
                                  </span>
                                  <span className="text-red-600 dark:text-red-400">
                                    {rule.indicators.overdue} Overdue:{" "}
                                    {rule.thresholds.overdue}d
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <button
                                  onClick={() => {
                                    setEditingTimeRule({ ...rule, index });
                                    setShowTimeModal(true);
                                  }}
                                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                  title="Edit rule"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => {
                                    setCardConfig((prev) => ({
                                      ...prev,
                                      timeSensitivity: {
                                        ...prev.timeSensitivity,
                                        rules:
                                          prev.timeSensitivity.rules.filter(
                                            (_, i) => i !== index
                                          ),
                                      },
                                    }));
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                  title="Delete rule"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Save Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveCardConfig}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rules Modal */}
      {showModal && (
        <RuleEditModalV2
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={() => {
            setShowModal(false);
            setEditingRule(null);
          }}
          api={api}
        />
      )}

      {/* Time Rule Modal */}
      {showTimeModal && (
        <TimeRuleEditModalV2
          rule={editingTimeRule}
          onSave={(rule) => {
            if (editingTimeRule?.index !== undefined) {
              // Update existing rule
              setCardConfig((prev) => ({
                ...prev,
                timeSensitivity: {
                  ...prev.timeSensitivity,
                  rules: prev.timeSensitivity.rules.map((r, i) =>
                    i === editingTimeRule.index ? rule : r
                  ),
                },
              }));
            } else {
              // Add new rule
              setCardConfig((prev) => ({
                ...prev,
                timeSensitivity: {
                  ...prev.timeSensitivity,
                  rules: [...prev.timeSensitivity.rules, rule],
                },
              }));
            }
            setShowTimeModal(false);
            setEditingTimeRule(null);
          }}
          onCancel={() => {
            setShowTimeModal(false);
            setEditingTimeRule(null);
          }}
        />
      )}
    </div>
  );
};

export default RulesViewV2;
