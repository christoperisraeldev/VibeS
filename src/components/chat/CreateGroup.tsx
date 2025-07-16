import { useState, useEffect } from "react";
import { X, Users, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User } from "./ChatLayout";
import { getAuth } from "firebase/auth";
import { database } from "@/lib/firebaseClient";
import {
  ref,
  get,
  push,
  set,
  serverTimestamp
} from "firebase/database";

interface Friend {
  uid: string;
  displayName: string;
  photoURL?: string;
  isOnline: boolean;
}

interface CreateGroupProps {
  onClose: () => void;
  onGroupCreated: (groupName: string, selectedUsers: User[]) => void;
}

export default function CreateGroup({ onClose, onGroupCreated }: CreateGroupProps) {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [groupName, setGroupName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!currentUser?.uid) return;
      
      setLoading(true);
      try {
        // Get current user's friends list
        const userRef = ref(database, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        
        if (!snapshot.exists()) {
          setFriends([]);
          return;
        }

        const userData = snapshot.val();
        const friendIds = userData.friends ? Object.keys(userData.friends) : [];
        
        // Fetch friend details
        if (friendIds.length > 0) {
          const friendsData: Friend[] = [];
          
          for (const friendId of friendIds) {
            const friendRef = ref(database, `users/${friendId}`);
            const friendSnapshot = await get(friendRef);
            
            if (friendSnapshot.exists()) {
              const friendData = friendSnapshot.val();
              friendsData.push({
                uid: friendId,
                displayName: friendData.displayName || "Unknown",
                photoURL: friendData.photoURL || "",
                isOnline: friendData.isOnline || false
              });
            }
          }
          
          setFriends(friendsData);
        } else {
          setFriends([]);
        }
      } catch (error) {
        console.error("Error fetching friends:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, [currentUser]);

  const filteredUsers = friends.filter(user =>
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUserSelection = (friend: Friend) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === friend.uid);
      if (isSelected) {
        return prev.filter(u => u.id !== friend.uid);
      } else {
        const user: User = {
          id: friend.uid,
          name: friend.displayName,
          avatar: friend.photoURL || "",
          online: friend.isOnline
        };
        return [...prev, user];
      }
    });
  };

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleCreate = async () => {
    if (!currentUser?.uid || !groupName.trim() || selectedUsers.length === 0) return;
    
    try {
      // Create group in Realtime Database
      const groupsRef = ref(database, 'groups');
      const newGroupRef = push(groupsRef);
      
      await set(newGroupRef, {
        name: groupName,
        members: {
          ...selectedUsers.reduce((acc, user) => {
            acc[user.id] = true;
            return acc;
          }, {} as Record<string, boolean>),
          [currentUser.uid]: true
        },
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });

      // Create initial group chat
      const chatsRef = ref(database, 'chats');
      const newChatRef = push(chatsRef);
      
      await set(newChatRef, {
        groupId: newGroupRef.key,
        messages: {},
        lastMessage: null,
        lastUpdated: serverTimestamp()
      });

      onGroupCreated(groupName, selectedUsers);
      onClose();
    } catch (error) {
      console.error("Failed to create group:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-background flex flex-col items-center justify-center">
        <p>Loading friends...</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create Group</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Group Name Input */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Group Name
            </label>
            <Input
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Selected Members ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="flex items-center gap-1 px-2 py-1"
                  >
                    {user.name}
                    <button
                      onClick={() => removeSelectedUser(user.id)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search Users */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Add Members
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Users List */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {friends.length === 0
                ? "You don't have any friends yet"
                : "No matching friends found"}
            </p>
          ) : (
            filteredUsers.map((user) => {
              const isSelected = selectedUsers.some(u => u.id === user.uid);
              
              return (
                <div
                  key={user.uid}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                    isSelected ? 'bg-muted' : ''
                  }`}
                  onClick={() => toggleUserSelection(user)}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.photoURL || ""} />
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                        {user.displayName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    {user.isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-background"></div>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{user.displayName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {user.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button
          onClick={handleCreate}
          disabled={!groupName.trim() || selectedUsers.length === 0}
          className="w-full"
        >
          <Users className="h-4 w-4 mr-2" />
          Create Group ({selectedUsers.length} members)
        </Button>
      </div>
    </div>
  );
}