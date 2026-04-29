import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, useCallback, useRef, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../services/api";
import {
  registerForPushNotificationsAsync,
  scheduleAllRemindersForMedicine,
  cancelAllRemindersForMedicine,
} from "../../services/NotificationService";

interface ScheduleItem {
  time: string;
  status: string;
}

interface MedicineModel {
  _id: string;
  name: string;
  dosage: string;
  schedule: ScheduleItem[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// In-App Toast component
// ---------------------------------------------------------------------------
interface ToastProps {
  visible: boolean;
  message: string;
  type: "success" | "error" | "info";
  onHide: () => void;
}

function Toast({ visible, message, type, onHide }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 8,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 8,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 30,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => onHide());
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const bgColor =
    type === "success"
      ? "#10b981"
      : type === "error"
        ? "#ef4444"
        : "#2563eb";

  const icon =
    type === "success"
      ? "check-circle"
      : type === "error"
        ? "alert-circle"
        : "information";

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 30,
        left: 20,
        right: 20,
        zIndex: 9999,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <View
        style={{
          backgroundColor: bgColor,
          borderRadius: 16,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 10,
          gap: 12,
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={22} color="white" />
        <Text
          style={{
            color: "white",
            fontWeight: "600",
            fontSize: 14,
            flex: 1,
            lineHeight: 20,
          }}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Medicine Reminder Card
// ---------------------------------------------------------------------------
interface MedicineCardProps {
  med: MedicineModel;
  onEdit: () => void;
  onDelete: () => void;
  onMarkTaken: (scheduleIndex: number) => void;
}

function MedicineCard({ med, onEdit, onDelete, onMarkTaken }: MedicineCardProps) {
  const isTaken = med.schedule?.[0]?.status === "taken";
  const time = med.schedule?.[0]?.time;

  return (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
        marginBottom: 14,
        shadowColor: "#64748b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: isTaken ? "#d1fae5" : "#f1f5f9",
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 14 }}>
        {/* Icon */}
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: isTaken ? "#d1fae5" : "#eff6ff",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <MaterialCommunityIcons
            name="pill"
            size={26}
            color={isTaken ? "#059669" : "#2563eb"}
          />
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 17, fontWeight: "700", color: "#1e293b", marginBottom: 2 }}
          >
            {med.name}
          </Text>
          <Text style={{ color: "#64748b", fontSize: 13 }}>
            {med.dosage}
          </Text>
          {med.notes ? (
            <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
              {med.notes}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Reminder Time Badge */}
      {time ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f0fdf4",
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: "#bbf7d0",
            gap: 8,
          }}
        >
          <MaterialCommunityIcons name="clock-outline" size={16} color="#059669" />
          <Text style={{ color: "#059669", fontWeight: "600", fontSize: 13 }}>
            Daily reminder at {time}
          </Text>
          <View
            style={{
              marginLeft: "auto",
              backgroundColor: "#10b981",
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>
              ACTIVE
            </Text>
          </View>
        </View>
      ) : null}

      {/* Action Row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        {/* Edit / Delete */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={onEdit}
            style={{
              backgroundColor: "#f1f5f9",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 50,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <MaterialCommunityIcons name="pencil-outline" size={14} color="#475569" />
            <Text style={{ color: "#475569", fontWeight: "600", fontSize: 12 }}>
              Edit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDelete}
            style={{
              backgroundColor: "#fff1f2",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 50,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <MaterialCommunityIcons name="delete-outline" size={14} color="#ef4444" />
            <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 12 }}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status */}
        {isTaken ? (
          <View
            style={{
              backgroundColor: "#d1fae5",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 50,
            }}
          >
            <Text style={{ color: "#059669", fontWeight: "700", fontSize: 12 }}>
              Taken ✓
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => onMarkTaken(0)}
            style={{
              backgroundColor: "#2563eb",
              paddingHorizontal: 16,
              paddingVertical: 9,
              borderRadius: 50,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>
              Mark Taken
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export default function MedicinesScreen() {
  const [medicines, setMedicines] = useState<MedicineModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicineModel | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDosage, setFormDosage] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Toast state
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({ visible: false, message: "", type: "success" });

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ visible: true, message, type });
  };

  // Request notification permissions on mount
  useEffect(() => {
    registerForPushNotificationsAsync().then((granted) => {
      if (!granted) {
        showToast(
          "Enable notifications in Settings to receive medicine reminders.",
          "info",
        );
      }
    });
  }, []);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        setLoading(false);
        return;
      }
      const response = await api.get<MedicineModel[]>(`/medicines/user/${userId}`);
      const rawMedicines = Array.isArray(response.data)
        ? response.data
        : (response as any);
      setMedicines(rawMedicines);
    } catch (error) {
      console.error("Error fetching medicines:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMedicines();
    }, []),
  );

  const openAddModal = () => {
    setEditingMed(null);
    setFormName("");
    setFormDosage("");
    setFormTime("");
    setFormNotes("");
    setModalVisible(true);
  };

  const openEditModal = (med: MedicineModel) => {
    setEditingMed(med);
    setFormName(med.name);
    setFormDosage(med.dosage);
    setFormTime(med.schedule?.[0]?.time || "");
    setFormNotes(med.notes || "");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formDosage.trim() || !formTime.trim()) {
      Alert.alert("Missing Fields", "Please fill in name, dosage, and time.");
      return;
    }

    const userId = await AsyncStorage.getItem("userId");
    if (!userId) return;

    const payload = {
      userId,
      name: formName.trim(),
      dosage: formDosage.trim(),
      schedule: [{ time: formTime.trim(), status: "pending" }],
      notes: formNotes.trim(),
    };

    setSaving(true);
    try {
      let savedMedId: string;

      if (editingMed) {
        await api.put(`/medicines/${editingMed._id}`, payload);
        savedMedId = editingMed._id;
      } else {
        const resp = await api.post<MedicineModel>("/medicines", payload);
        savedMedId = (resp.data as any)?._id || "";
      }

      setModalVisible(false);

      // Schedule local notification(s)
      if (savedMedId) {
        await scheduleAllRemindersForMedicine(
          savedMedId,
          formName.trim(),
          formDosage.trim(),
          [{ time: formTime.trim() }],
        );
        showToast(
          `Reminder set for ${formName.trim()} at ${formTime.trim()} 🔔`,
          "success",
        );
      }

      fetchMedicines();
    } catch (error) {
      console.error("Error saving medicine:", error);
      showToast("Could not save medicine.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (med: MedicineModel) => {
    Alert.alert(
      "Delete Medicine",
      `Delete "${med.name}" and cancel its reminder?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Cancel local notification first
              await cancelAllRemindersForMedicine(med._id);
              await api.delete(`/medicines/${med._id}`);
              fetchMedicines();
              showToast(`"${med.name}" deleted and reminder cancelled.`, "info");
            } catch (error) {
              console.error("Error deleting medicine:", error);
              showToast("Could not delete medicine.", "error");
            }
          },
        },
      ],
    );
  };

  const confirmDose = async (medicineId: string, scheduleIndex: number) => {
    try {
      setMedicines((prev) =>
        prev.map((m) =>
          m._id === medicineId
            ? {
              ...m,
              schedule: m.schedule.map((s, i) =>
                i === scheduleIndex ? { ...s, status: "taken" } : s,
              ),
            }
            : m,
        ),
      );
      await api.put(`/medicines/${medicineId}/status`, {
        scheduleIndex,
        status: "taken",
      });
      showToast("Great job! Dose marked as taken ✓", "success");
    } catch (error) {
      console.error("Error updating medicine status:", error);
      fetchMedicines();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text style={{ fontSize: 28, fontWeight: "800", color: "#1e293b" }}>
            Medicines
          </Text>
          <Text style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>
            Your daily schedule & reminders
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={openAddModal}
            style={{
              backgroundColor: "#2563eb",
              borderRadius: 50,
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#2563eb",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <MaterialCommunityIcons name="plus" size={22} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={fetchMedicines}
            style={{
              backgroundColor: "#e2e8f0",
              borderRadius: 50,
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="refresh" size={20} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#2563eb"
            style={{ marginTop: 60 }}
          />
        ) : medicines.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <View
              style={{
                width: 90,
                height: 90,
                borderRadius: 45,
                backgroundColor: "#eff6ff",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <MaterialCommunityIcons name="pill" size={44} color="#bfdbfe" />
            </View>
            <Text
              style={{ fontSize: 18, fontWeight: "700", color: "#334155", marginBottom: 8 }}
            >
              No medicines yet
            </Text>
            <Text
              style={{ color: "#94a3b8", textAlign: "center", marginBottom: 28, lineHeight: 20 }}
            >
              Add your first medicine and set a daily reminder to stay on track.
            </Text>
            <TouchableOpacity
              onPress={openAddModal}
              style={{
                backgroundColor: "#2563eb",
                paddingHorizontal: 28,
                paddingVertical: 14,
                borderRadius: 50,
                shadowColor: "#2563eb",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 6,
              }}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                Add Medicine
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingTop: 4 }}>
            {medicines.map((med) => (
              <MedicineCard
                key={med._id}
                med={med}
                onEdit={() => openEditModal(med)}
                onDelete={() => handleDelete(med)}
                onMarkTaken={(idx) => confirmDose(med._id, idx)}
              />
            ))}
            <View style={{ height: 40 }} />
          </View>
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
          <View
            style={{
              backgroundColor: "white",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: 40,
            }}
          >
            {/* Handle bar */}
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: "#e2e8f0",
                borderRadius: 2,
                alignSelf: "center",
                marginBottom: 20,
              }}
            />

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: "#1e293b" }}>
                {editingMed ? "Edit Medicine" : "Add Medicine"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={26} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Medicine Name */}
            <Text style={{ color: "#64748b", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              Medicine Name
            </Text>
            <TextInput
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                color: "#1e293b",
                marginBottom: 16,
                borderWidth: 1,
                borderColor: "#e2e8f0",
              }}
              placeholder="e.g. Paracetamol"
              placeholderTextColor="#94a3b8"
              value={formName}
              onChangeText={setFormName}
            />

            {/* Dosage */}
            <Text style={{ color: "#64748b", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              Dosage
            </Text>
            <TextInput
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                color: "#1e293b",
                marginBottom: 16,
                borderWidth: 1,
                borderColor: "#e2e8f0",
              }}
              placeholder="e.g. 500mg"
              placeholderTextColor="#94a3b8"
              value={formDosage}
              onChangeText={setFormDosage}
            />

            {/* Reminder Time */}
            <Text style={{ color: "#64748b", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              ⏰ Reminder Time
            </Text>
            <TextInput
              style={{
                backgroundColor: "#f0fdf4",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                color: "#1e293b",
                marginBottom: 4,
                borderWidth: 1.5,
                borderColor: "#bbf7d0",
              }}
              placeholder="e.g. 08:00 AM  or  20:30"
              placeholderTextColor="#94a3b8"
              value={formTime}
              onChangeText={setFormTime}
            />
            <Text style={{ color: "#6ee7b7", fontSize: 11, marginBottom: 16, marginLeft: 4 }}>
              A local notification will fire on your device every day at this time.
            </Text>

            {/* Notes */}
            <Text style={{ color: "#64748b", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              Notes (optional)
            </Text>
            <TextInput
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                color: "#1e293b",
                marginBottom: 24,
                borderWidth: 1,
                borderColor: "#e2e8f0",
              }}
              placeholder="e.g. Take after meals"
              placeholderTextColor="#94a3b8"
              value={formNotes}
              onChangeText={setFormNotes}
            />

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={{
                backgroundColor: saving ? "#93c5fd" : "#2563eb",
                paddingVertical: 16,
                borderRadius: 18,
                alignItems: "center",
                shadowColor: "#2563eb",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 6,
              }}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
                  {editingMed ? "Save Changes" : "Add Medicine & Set Reminder"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* In-App Toast */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </SafeAreaView>
  );
}
